const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const authMiddleware = require('../middleware/authmiddleware');
const Message = require('../model/chatModel');
const Auth = require('../model/authModel');
const { google } = require('googleapis');
const multer = require('multer');
const dotenv = require('dotenv');
const { Readable } = require('stream');
const drive = require('../googleDrive')
dotenv.config();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Middleware to check if users are friends
const checkFriendship = async (req, res, next) => {
    const userId = req.user._id;
    const { receiverId } = req.body;

    const user = await Auth.findById(userId).populate('friends.user', 'id');
    const isFriend = user.friends.some(friend => friend.user._id.toString() === receiverId);

    if (!isFriend) {
        return res.status(403).json({ message: 'You are not friends with this user' });
    }

    next();
};

router.use(authMiddleware);

// Parent folder ID (create this folder manually in Google Drive and get its ID)
const PARENT_FOLDER_ID = '1GE32NAwA9yR-C6Ggm-YL8BzLXo2102eR';

// Function to upload file to Google Drive
const uploadToDrive = async (file, parentFolderId) => {
    const { originalname, mimetype, buffer } = file;

    const fileMetadata = {
        name: originalname,
        parents: [parentFolderId] // Set the parent folder ID
    };

    const bufferStream = new Readable();
    bufferStream.push(buffer);
    bufferStream.push(null);

    const media = {
        mimeType: mimetype,
        body: bufferStream,
    };

    const response = await drive.files.create({
        resource: fileMetadata,
        media: media,
        fields: 'id',
    });

    return response.data.id;
};

// Send Message
router.post('/send', upload.single('file'), checkFriendship, async (req, res) => {
    const { receiverId, content, type } = req.body;
    const senderId = req.user._id;

    try {
        let fileId = null;
        if (req.file) {
            fileId = await uploadToDrive(req.file, PARENT_FOLDER_ID);
        }

        const message = new Message({
            sender: senderId,
            receiver: receiverId,
            content: fileId ? `https://drive.google.com/thumbnail?id=${fileId}` : content,
            type: req.file ? (req.file.mimetype.startsWith('image') ? 'photo' : 'file') : type,
            direction: 'sent' // Mark message as sent
        });

        await message.save();
        res.status(201).json(message);

    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ message: 'Failed to send message' });
    }
});

// Get Chat History
router.get('/history/:friendId', async (req, res) => {
    try {
        const friendId = req.params.friendId;
        const userId = req.user._id; // Assuming you have auth middleware that sets req.user

        // Fetch messages between userId and friendId
        const messages = await Message.find({
            $or: [
                { sender: userId, receiver: friendId },
                { sender: friendId, receiver: userId }
            ]
        }).sort({ createdAt: 1 });

        // Add direction property to each message
        const formattedMessages = messages.map(message => ({
            ...message.toObject(),
            direction: message.sender.toString() === userId.toString() ? 'sent' : 'received'
        }));

        res.json(formattedMessages);
    } catch (error) {
        console.error('Error fetching chat history:', error.message);
        res.status(500).json({ error: 'Failed to fetch chat history' });
    }
});

module.exports = router;
