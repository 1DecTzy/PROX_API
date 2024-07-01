const mongoose = require('mongoose');

const ChatGroupSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    members: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Auth',
        required: true
    }],
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Auth',
        required: true
    }
}, { timestamps: true });

module.exports = mongoose.model('ChatGroup', ChatGroupSchema);
