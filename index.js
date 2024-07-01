const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const jwt = require('jsonwebtoken'); // For JWT handling
const cookieParser = require('cookie-parser'); // For parsing cookies
const Message = require('./model/chatModel');
const Auth = require('./model/authModel');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: 'http://localhost:3000', // Update with your client's origin
        methods: ['GET', 'POST'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        credentials: true
    }
});

const PORT = process.env.PORT || 5000;

const corsOptions = {
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser()); // Parse cookies

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err.stack);
    res.status(500).send('Internal Server Error');
});

// Database connection
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
    .then(() => console.log('MongoDB connected'))
    .catch((err) => console.error('Error connecting to MongoDB:', err));

// Authenticate Socket.IO connections
io.use(async (socket, next) => {
    try {
        const token = socket.handshake.auth.token; // Extract token from handshake auth
        if (!token) {
            throw new Error('Unauthorized: Token not provided');
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Attach user data to socket for use in event handlers
        socket.user = await Auth.findOne({ email: decoded.email });
        if (!socket.user) {
            throw new Error('Unauthorized: User not found');
        }

        next(); // Proceed to connection
    } catch (error) {
        console.error('Socket.IO authentication error:', error.message);
        next(new Error('Authentication error')); // Terminate connection
    }
});

// Routes
app.use('/uploads', express.static('uploads'));
app.use(require('./router/login'));
app.use(require('./router/signup'));
app.use(require('./router/otp'));
app.use(require('./router/forget'));
app.use(require('./router/getuser'));
app.use('/chat', require('./router/chat'));
app.use('/friend', require('./router/friend'));
app.use(require('./router/document'));

app.get("*", (req, res) => {
    res.status(404).send("NOT FOUND");
});

// Socket.io connection
// Socket.io connection
io.on('connection', (socket) => {
    console.log('User connected:', socket.user.firstname, socket.user.lastname);

    socket.on('join', (userId) => {
        socket.join(userId);
        console.log(`User ${userId} joined room`);
    });

    socket.on('sendMessage', async ({ receiverId, content, type }) => {
        try {
            const senderId = socket.user._id; // Assuming socket.user._id is correctly set
            const receiver = await Auth.findById(receiverId);
            console.log(senderId)
            if (!receiver) {
                throw new Error(`Receiver not found for ID: ${receiverId}`);
            }

            const message = new Message({
                sender: senderId,
                receiver: receiverId,
                content,
                type,
                direction: 'sent'
            });

            await message.save();

            // Emit the message to the receiver's room
            io.to(receiverId).emit('message', { ...message.toObject(), direction: 'received' });
            // Optionally, emit the message to the sender as well
            io.to(senderId).emit('message', message);
        } catch (error) {
            console.error('Error sending message:', error.message);
            // Emit an error event or handle accordingly
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.user.firstname, socket.user.lastname);
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Running on http://localhost:${PORT}`);
});
