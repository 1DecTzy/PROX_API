const express = require('express');
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');
const multer = require('multer'); // Middleware for handling file uploads
const path = require('path');
const Auth = require('../model/authModel');
const drive = require('../googleDrive'); // Assuming this is your Google Drive integration file
const URL = require('../URL');
const router = express.Router();
const fs = require('fs');

// Multer setup for avatar uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, '../uploads/profile')); // Local destination folder for avatar uploads
    },
    filename: function (req, file, cb) {
        cb(null, `${file.originalname}`); // File naming convention
    }
});

const upload = multer({ storage: storage });

// Function to send OTP email
async function sendOTPEmail(email, otp) {
    const transporter = nodemailer.createTransport({
        service: 'Gmail',
        auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.APP_PASS,
        },
    });

    const mailOptions = {
        from: process.env.GMAIL_USER,
        to: email,
        subject: 'OTP for Signup',
        text: `Your OTP for signup is: ${otp}`,
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
}

// Function to upload avatar to Google Drive and return direct link
async function uploadAvatarToDrive(file) {
    const driveResponse = await drive.files.create({
        requestBody: {
            name: file.originalname,
            mimeType: file.mimetype,
            parents: ['17OdJ37o9coDdSFMaqWWDXr0GcAZ-guGe'], // Replace with your folder ID
        },
        media: {
            mimeType: file.mimetype,
            body: fs.createReadStream(file.path),
        },
    });

    const fileId = driveResponse.data.id;

    // Make the file publicly accessible
    await drive.permissions.create({
        fileId: driveResponse.data.id,
        requestBody: {
            role: 'reader',
            type: 'anyone',
        },
    });

    // Construct the Google Drive direct download link
    const fileUrl = `https://drive.google.com/thumbnail?id=${fileId}`;

    return fileUrl;
}

router.post('/signup', upload.single('avatar'), async (req, res) => {
    const { firstname, lastname, email, password, re_password, sex, dob } = req.body;

    if (password !== re_password) {
        return res.status(400).json({ message: 'Passwords do not match!' });
    }

    try {
        const existingUser = await Auth.findOne({ email });
        if (existingUser) {
            if (existingUser.verified) {
                return res.status(400).json({ message: 'Email is already registered and verified' });
            } else {
                // If the user exists but is not verified, allow to resend OTP
                const otp = Math.floor(100000 + Math.random() * 900000).toString();
                existingUser.otp = otp;
                await existingUser.save();

                // Send OTP email
                await sendOTPEmail(email, otp);

                return res.status(200).json({ message: 'OTP re-sent to email' });
            }
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        let avatarUrl = `${URL}/uploads/profile/${req.file.filename}`; // Local avatar URL

        // Check if avatar file was uploaded
        if (req.file) {
            // Upload avatar to Google Drive
            avatarUrl = await uploadAvatarToDrive(req.file);
        }

        // Create new Auth document with avatarUrl and otp included
        await Auth.create({ firstname, lastname, email, password: hashedPassword, re_password: hashedPassword, sex, dob, avatar: avatarUrl, otp });

        // Send initial OTP email
        await sendOTPEmail(email, otp);

        res.status(200).json({ message: 'Initial OTP sent to email' });
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ message: 'Error creating user' });
    }
});

module.exports = router;
