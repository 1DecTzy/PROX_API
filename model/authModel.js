const mongoose = require('mongoose');

const AuthSchema = new mongoose.Schema({
    firstname: {
        type: String,
        default: 'First Name',
        required: true,
        minlength: 3,
        maxlength: 200,
    },
    lastname: {
        type: String,
        default: 'Last Name',
        required: true,
        minlength: 3,
        maxlength: 200,
    },
    dob: {
        type: String,
        required: true
    },
    sex: {
        type: String,
        required: true,
        maxlength: 6,
    },
    email: {
        type: String,
        required: ["Please provide an Email!"],
        unique: [true, "Email Exist"],
        required: true
    },
    password: {
        type: String,
        required: true,
        minlength: 8,
        maxlength: 1024,
    },
    re_password: {
        type: String,
        required: true,
        minlength: 3,
        maxlength: 1024,
    },
    avatar: {
        type: String,
        default: '',
    },
    otp: {
        type: String,
        required: true
    },
    verified: {
        type: Boolean,
        default: false
    },
    resetOtp: {
        type: String,
        default: ''
    },
    resetOtpExpiry: {
        type: Date,
        default: null
    },
    status: {
        type: String,
        enum: ['online', 'offline'],
        default: 'offline'
    },
    friends: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Auth',
        },
    }],
    friendRequests: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Auth',
        },
    }],
    sentRequests: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Auth',
        },
    }],
}, { timestamps: true });

module.exports = mongoose.model('Auth', AuthSchema);
