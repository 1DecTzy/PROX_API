const express = require('express');
const bcrypt = require('bcryptjs');
const Auth = require('../model/authModel');
const nodemailer = require('nodemailer');

const router = express.Router();

const sendOtpEmail = async (email, otp) => {
    const transporter = nodemailer.createTransport({
        service: 'Gmail',
        auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.APP_PASS
        }
    });

    const mailOptions = {
        from: process.env.GMAIL_USER,
        to: email,
        subject: 'Password Reset OTP',
        text: `Your OTP for password reset is: ${otp}`
    };

    return new Promise((resolve, reject) => {
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error('Error sending email:', error);
                reject(error);
            } else {
                console.log('Email sent:', info.response);
                resolve();
            }
        });
    });
};

router.post('/forget', async (req, res) => {
    const { email } = req.body;
    try {
        const user = await Auth.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'User not found' });
        }
        const resetOtp = Math.floor(100000 + Math.random() * 900000).toString();
        const resetOtpExpiry = Date.now() + 3600000; // 1 hour
        user.resetOtp = resetOtp;
        user.resetOtpExpiry = resetOtpExpiry;
        await user.save();
        await sendOtpEmail(email, resetOtp); // Implement this function to send OTP email
        res.status(200).json({ message: 'OTP sent to email' });
    } catch (error) {
        console.error('Error generating OTP:', error);
        res.status(500).json({ message: 'Error generating OTP' });
    }
});

router.post('/reset-password', async (req, res) => {
    const { email, oldPassword, newPassword, rePassword, otp } = req.body;
    try {
        const user = await Auth.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'User not found' });
        }

        // Option 1: Using old password
        if (oldPassword) {
            const isPasswordValid = await bcrypt.compare(oldPassword, user.password);
            if (!isPasswordValid) {
                return res.status(400).json({ message: 'Invalid old password' });
            }
            if (newPassword !== rePassword) {
                return res.status(400).json({ message: 'Passwords do not match' });
            }
            user.password = await bcrypt.hash(newPassword, 10);
            user.re_password = await bcrypt.hash(rePassword, 10);
            await user.save();
            return res.status(200).json({ message: 'Password reset successful' });
        }

        // Option 2: Using OTP
        if (otp) {
            if (otp !== user.resetOtp || Date.now() > user.resetOtpExpiry) {
                return res.status(400).json({ message: 'Invalid or expired OTP' });
            }
            if (newPassword !== rePassword) {
                return res.status(400).json({ message: 'Passwords do not match' });
            }
            user.password = await bcrypt.hash(newPassword, 10);
            user.re_password = await bcrypt.hash(rePassword, 10);
            user.resetOtp = '';
            user.resetOtpExpiry = null;
            await user.save();
            return res.status(200).json({ message: 'Password reset successful' });
        }

        res.status(400).json({ message: 'Invalid request' });
    } catch (error) {
        console.error('Error resetting password:', error);
        res.status(500).json({ message: 'Error resetting password' });
    }
});

module.exports = router;
