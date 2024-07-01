const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
    name: String,
    url: String,
    driveFileId: { type: String, required: true }
});
const childfolderSchema = new mongoose.Schema({
    name : {
        type: String, required: true
    },
    files: [fileSchema],
    driveFolderId: { type: String },
})
const folderSchema = new mongoose.Schema({
    name: { type: String, required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'Auth', required: true },
    files: [fileSchema],
    childFolder : [childfolderSchema],
    driveFolderId: { type: String },  // Google Drive folder ID
}, { timestamps: true });

module.exports = mongoose.model('Folder', folderSchema);
