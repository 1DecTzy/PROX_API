const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authmiddleware');
const Auth = require('../model/authModel');
const nodemailer = require('nodemailer');

// Configure Nodemailer transporter
const transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.APP_PASS,
    },
});

router.use(authMiddleware);

// Add Friend Request by Email
router.post('/add-friend', async (req, res) => {
    try {
        const { email } = req.body;
        const currentUser = req.user;

        // Check if user is trying to add themselves
        if (currentUser.email === email) {
            return res.status(400).json({ message: 'Cannot add yourself as a friend' });
        }

        // Find the user by email
        const friend = await Auth.findOne({ email });
        if (!friend) {
            return res.status(404).json({ message: 'Friend not found' });
        }

        // Check if friend request already exists
        if (currentUser.friends.some(f => f.user.equals(friend._id)) || currentUser.sentRequests.some(f => f.user.equals(friend._id))) {
            return res.status(400).json({ message: 'Friend request already sent' });
        }

        // Add friend request to currentUser
        currentUser.sentRequests.push({ user: friend._id });
        await currentUser.save();

        // Add friend request to friend
        friend.friendRequests.push({ user: currentUser._id });
        await friend.save();

        // Send email notification to friend
        const mailOptions = {
            from: process.env.GMAIL_USER,
            to: friend.email,
            subject: 'New Friend Request',
            text: `${currentUser.email} has sent you a friend request.`,
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.log('Error sending email:', error);
            } else {
                console.log('Email sent:', info.response);
            }
        });
        res.status(200).json({ message: 'Friend request sent successfully', friend: friend });
    } catch (error) {
        console.error('Error sending friend request:', error);
        res.status(500).json({ message: 'Failed to send friend request' });
    }
});

// Confirm Friend Request by Email
router.post('/confirm-friend', async (req, res) => {
    try {
        const { email } = req.body;
        const user = await Auth.findById(req.user.id);
        const friend = await Auth.findOne({ email });

        if (!friend) {
            return res.status(404).json({ message: 'User not found' });
        }

        const requestIndex = user.friendRequests.findIndex(request => request.user.equals(friend._id));
        if (requestIndex === -1) {
            return res.status(400).json({ message: 'No friend request from this user' });
        }

        user.friends.push({ user: friend._id, status: 'online' });
        user.friendRequests.splice(requestIndex, 1);
        await user.save();

        const sentRequestIndex = friend.sentRequests.findIndex(request => request.user.equals(user._id));
        if (sentRequestIndex !== -1) {
            friend.sentRequests.splice(sentRequestIndex, 1);
        }

        friend.friends.push({ user: user._id, status: 'online' });
        await friend.save();

        const mailOptions = {
            from: process.env.GMAIL_USER,
            to: friend.email,
            subject: 'Friend Request Accepted',
            text: `${user.email} has accepted your friend request.`,
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.log('Error sending email:', error);
                res.status(500).json({ message: 'Error sending email', error: error.message });
            } else {
                console.log('Email sent:', info.response);
                res.status(200).json({ message: 'Friend request confirmed' });
            }
        });

        res.status(200).json({ message: 'Friend request confirmed' });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// List Friends
router.get('/friends', async (req, res) => {
    try {
        const user = await Auth.findById(req.user.id).populate('friends.user', 'firstname lastname email avatar status');
        res.status(200).json(user.friends);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Unfriend
router.post('/unfriend', async (req, res) => {
    try {
        const { email } = req.body;
        const user = await Auth.findById(req.user.id);
        const friend = await Auth.findOne({ email });

        if (!friend) {
            return res.status(404).json({ message: 'User not found' });
        }

        user.friends = user.friends.filter(f => !f.user.equals(friend._id));
        await user.save();

        friend.friends = friend.friends.filter(f => !f.user.equals(user._id));
        await friend.save();

        res.status(200).json({ message: 'Unfriended successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Cancel Friend Request

router.post('/cancel-friend-request', async (req, res) => {
    try {
        const { email } = req.body;
        const user = await Auth.findById(req.user.id);
        const friend = await Auth.findOne({ email });

        if (!friend) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Remove friend from user's sentRequests
        user.sentRequests = user.sentRequests.filter(request => !request.user.equals(friend._id));

        // Remove user from friend's friendRequests
        friend.friendRequests = friend.friendRequests.filter(request => !request.user.equals(user._id));

        const mailOptions = {
            from: process.env.GMAIL_USER,
            to: friend.email,
            subject: 'Friend Request Canceled',
            text: `${user.email} has cancel your friend request.`,
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.log('Error sending email:', error);
                res.status(500).json({ message: 'Error sending email', error: error.message });
            } else {
                console.log('Email sent:', info.response);
                res.status(200).json({ message: 'Friend request confirmed' });
            }
        });
        // Save both documents
        await user.save();
        await friend.save();

        res.status(200).json({ message: 'Friend request canceled' });
    } catch (err) {
        console.error('Server error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});


// List Friend Requests
router.get('/friend-requests', async (req, res) => {
    try {
        const user = await Auth.findById(req.user.id).populate({
            path: 'friendRequests.user',
            select: 'firstname lastname email avatar'
        });
        res.status(200).json(user.friendRequests);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// List Sent Friend Requests
router.get('/sent-requests', async (req, res) => {
    try {
        const user = await Auth.findById(req.user.id).populate({
            path: 'sentRequests.user',
            select: 'firstname lastname email avatar'
        });
        res.status(200).json(user.sentRequests);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

module.exports = router;
