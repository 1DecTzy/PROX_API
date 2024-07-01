const express = require('express');
const jwt = require('jsonwebtoken');
const Auth = require('../model/authModel');
const loginMiddleware = require('../middleware/loginmiddleware');
const authMiddleware = require('../middleware/authmiddleware');
const router = express.Router();

router.post('/login', loginMiddleware, async (req, res) => {
    const { email } = req.body;
    const user = req.user;
    user.status = 'online';
    await user.save();
    const token = jwt.sign(
        { email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: '24h' } // Token expires in 24 hours
    );

    res.status(200).json({ token, message: `Welcome, ${user.lastname}!` });
});

router.post('/logout', authMiddleware, async (req, res) => {
    try {
        const currentUser = req.user;

        // Find user and update status to 'offline'
        const user = await Auth.findById(currentUser._id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        user.status = 'offline';
        await user.save();

        res.status(200).json({ message: 'Logged out successfully' });
    } catch (error) {
        console.error('Error logging out:', error);
        res.status(500).json({ message: 'Error logging out' });
    }
});
module.exports = router;
