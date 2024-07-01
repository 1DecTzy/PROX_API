const express = require('express');
const jwt = require('jsonwebtoken');
const Auth = require('../model/authModel');
const router = express.Router();

router.post('/signup/verify-otp', async (req, res) => {
    const { email, otp } = req.body;
    try {
        const user = await Auth.findOne({ email, otp });

        if (!user) {
            return res.status(400).json({ message: 'Invalid OTP' });
        }

        // Update user's verified status
        user.verified = true;
        await user.save();

        // Generate JWT token
        const token = jwt.sign({ email: user.email }, process.env.JWT_SECRET, { expiresIn: '1h' });

        res.status(200).json({ token, message: "OTP verified successfully" });
    } catch (error) {
        console.error('Error verifying OTP:', error);
        res.status(500).json({ message: 'Error verifying OTP' });
    }
});

module.exports = router;



