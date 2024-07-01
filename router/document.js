const express = require('express');
const multer = require('multer');
const fs = require('fs');
const authMiddleware = require('../middleware/authmiddleware');
const Folder = require('../model/documentModel');
const drive = require('../googleDrive');
const router = express.Router();
const upload = multer({ dest: 'uploads/documents' });


// POST route to create a new folder
router.post('/folder', authMiddleware, async (req, res) => {
    const { folderName } = req.body; // Add parentFolderId to request body
    const userId = req.user._id;

    if (!folderName) {
        return res.status(400).json({ message: 'Folder name is required' });
    }

    try {
        // Check if folder with the same name already exists for the user
        const existingFolder = await Folder.findOne({ name: folderName, user: userId });
        if (existingFolder) {
            return res.status(400).json({ message: 'Folder with the same name already exists' });
        }

        // Create folder on Google Drive under the specified parent folder
        const driveResponse = await drive.files.create({
            requestBody: {
                name: folderName,
                mimeType: 'application/vnd.google-apps.folder',
                parents: ['1QJZWegH9Y-J_rmdjidR_Uq3XtaxTv5Hc'], // Specify the parent folder ID here
            },
            fields: 'id',
        });

        const newFolder = new Folder({
            name: folderName,
            user: userId,
            driveFolderId: driveResponse.data.id, // Store Google Drive folder ID
            files: [], // Initialize with an empty array
        });

        await newFolder.save();
        res.status(201).json(newFolder); // Return the newly created folder
    } catch (error) {
        console.error('Error creating folder:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});
router.post('/folder/:folderId', authMiddleware, async (req, res) => {
    const { folderId } = req.params;
    const { folderName } = req.body;
    const userId = req.user._id;

    if (!folderName) {
        return res.status(400).json({ message: 'Folder name is required' });
    }

    try {
        const parentFolder = await Folder.findOne({ _id: folderId, user: userId });
        if (!parentFolder) {
            return res.status(404).json({ message: 'Folder not found' });
        }

        // Get the parent folder's Google Drive ID
        const driveFolderId = parentFolder.driveFolderId;

        // Check if a folder with the same name already exists for the user
        const existingFolder = await Folder.findOne({ name: folderName, user: userId });
        if (existingFolder) {
            return res.status(400).json({ message: 'Folder with the same name already exists' });
        }

        // Create a folder on Google Drive under the specified parent folder
        const driveResponse = await drive.files.create({
            requestBody: {
                name: folderName,
                mimeType: 'application/vnd.google-apps.folder',
                parents: [driveFolderId], // Specify the parent folder ID here
            },
            fields: 'id',
        });

        // Update the parent folder's childFolder array
        parentFolder.childFolder.push({
            name: folderName,
            driveFolderId: driveResponse.data.id, // Store the Google Drive folder ID
        });

        await parentFolder.save();

        res.status(201).json(parentFolder); // Return the newly created folder
    } catch (error) {
        console.error('Error creating folder:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

router.get('/folder/:folderId', authMiddleware, async (req, res) => {
    const { folderId } = req.params;
    const userId = req.user._id;

    try {
        const folder = await Folder.findOne({ _id: folderId, user: userId }).populate('childFolder');
        if (!folder) {
            return res.status(404).json({ message: 'Folder not found' });
        }

        res.status(200).json(folder);
    } catch (error) {
        console.error('Error fetching folder:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});
// Delete a child folder
router.delete('/folder/:parentFolderId/childFolder/:childFolderId', authMiddleware, async (req, res) => {
    try {
        const { parentFolderId, childFolderId } = req.params;
        const userId = req.user._id;

        // Find the parent folder by its ID and ensure it belongs to the current user
        const parentFolder = await Folder.findOne({ _id: parentFolderId, user: userId });
        if (!parentFolder) {
            return res.status(404).json({ message: 'Parent folder not found' });
        }

        // Find the child folder within the parent folder
        const childFolder = parentFolder.childFolder.id(childFolderId);
        if (!childFolder) {
            return res.status(404).json({ message: 'Child folder not found' });
        }

        // Delete child folder from Google Drive
        await drive.files.delete({
            fileId: childFolder.driveFolderId,
        });

        // Remove the child folder from the parent folder's childFolder array
        parentFolder.childFolder.pull({ _id: childFolderId });

        // Save the parent folder document to persist the changes
        await parentFolder.save();

        res.status(200).json({ message: 'Child folder deleted successfully' });
    } catch (error) {
        console.error('Error deleting child folder:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Rename a child folder
router.put('/folder/:parentFolderId/childFolder/:childFolderId', authMiddleware, async (req, res) => {
    try {
        const { parentFolderId, childFolderId } = req.params;
        const { name } = req.body;
        const userId = req.user._id;

        // Find the parent folder by its ID and ensure it belongs to the current user
        const parentFolder = await Folder.findOne({ _id: parentFolderId, user: userId });
        if (!parentFolder) {
            return res.status(404).json({ message: 'Parent folder not found' });
        }

        // Find the child folder within the parent folder
        const childFolder = parentFolder.childFolder.id(childFolderId);
        if (!childFolder) {
            return res.status(404).json({ message: 'Child folder not found' });
        }

        // Update the child folder name in MongoDB
        childFolder.name = name;
        await parentFolder.save();

        res.status(200).json({ message: 'Child folder renamed successfully' });
    } catch (error) {
        console.error('Error renaming child folder:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});


// POST route to upload files to an existing folder
router.post('/folder/files/:folderId', authMiddleware, upload.array('files'), async (req, res) => {
    const { folderId } = req.params;
    const userId = req.user._id;

    try {
        // Find the parent folder by its ID and ensure it belongs to the current user
        const parentFolder = await Folder.findOne({ _id: folderId, user: userId });
        if (!parentFolder) {
            return res.status(404).json({ message: 'Folder not found' });
        }

        // Assume driveFolderId is a field in parentFolder schema
        const driveFolderId = parentFolder.driveFolderId;

        // Upload files to Google Drive folder
        const fileUploadPromises = req.files.map(async file => {
            const fileMetadata = {
                name: file.originalname,
                parents: [driveFolderId], // Specify the parent folder ID for Google Drive
            };

            const media = {
                mimeType: file.mimetype,
                body: fs.createReadStream(file.path),
            };

            try {
                const driveResponse = await drive.files.create({
                    requestBody: fileMetadata,
                    media: media,
                    fields: 'id',
                });

                const uploadedFile = {
                    name: file.originalname,
                    url: `https://drive.google.com/uc?id=${driveResponse.data.id}`, // Example URL to access the file
                    driveFileId: driveResponse.data.id // Store the Google Drive file ID
                };

                return uploadedFile;
            } catch (error) {
                console.error('Error uploading file to Google Drive:', error);
                throw error; // Propagate error to handle it centrally
            }
        });

        // Execute all file upload promises concurrently
        const uploadedFiles = await Promise.all(fileUploadPromises);

        // Update parent folder's files array with uploaded files
        parentFolder.files = parentFolder.files.concat(uploadedFiles);
        await parentFolder.save();

        // Clean up uploaded files from disk
        req.files.forEach(file => fs.unlinkSync(file.path));

        res.status(200).json(parentFolder); // Return the updated parent folder
    } catch (error) {
        console.error('Error uploading files:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Get all folders for the user
router.get('/folders', authMiddleware, async (req, res) => {
    try {
        const folders = await Folder.find({ user: req.user._id });
        res.status(200).json(folders);
    } catch (error) {
        console.error('Error fetching folders:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Rename a folder
router.put('/folder/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { name } = req.body;

        // Find the folder by its ID
        const folder = await Folder.findById(id);
        if (!folder) {
            return res.status(404).json({ message: 'Folder not found' });
        }

        // Update the folder name in Google Drive
        await drive.files.update({
            fileId: folder.driveFolderId,
            requestBody: {
                name: name,
            },
        });

        // Update the folder name in MongoDB
        folder.name = name;
        await folder.save();

        res.status(200).json({ message: 'Folder renamed successfully' });
    } catch (error) {
        console.error('Error renaming folder:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Rename a file
router.put('/folder/:folderId/file/:fileId', authMiddleware, async (req, res) => {
    try {
        const { folderId, fileId } = req.params;
        const { name } = req.body;

        // Find the folder by its ID and ensure it belongs to the current user
        const folder = await Folder.findOne({ _id: folderId, user: req.user._id });
        if (!folder) {
            return res.status(404).json({ message: 'Folder not found' });
        }

        // Find the file within the folder by its ID
        const file = folder.files.find(file => file._id.equals(fileId));
        if (!file) {
            return res.status(404).json({ message: 'File not found' });
        }

        // Update the file name in Google Drive
        await drive.files.update({
            fileId: file.driveFileId,
            requestBody: {
                name: name,
            },
        });

        // Update the file name in MongoDB
        file.name = name;
        await folder.save();

        res.status(200).json({ message: 'File renamed successfully' });
    } catch (error) {
        console.error('Error renaming file:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Delete a folder
router.delete('/folder/:id', authMiddleware, async (req, res) => {
    try {
        const folderId = req.params.id;

        // Find the folder by its ID
        const folder = await Folder.findById(folderId);

        if (!folder) {
            return res.status(404).json({ message: 'Folder not found' });
        }

        // Delete folder from Google Drive
        try {
            await drive.files.delete({
                fileId: folder.driveFolderId,
            });
        } catch (driveError) {
            console.error('Error deleting folder from Google Drive:', driveError);
            return res.status(500).json({ message: 'Error deleting folder from Google Drive' });
        }

        // Delete folder from MongoDB
        try {
            await Folder.findByIdAndDelete(folderId);
        } catch (mongoError) {
            console.error('Error deleting folder from MongoDB:', mongoError);
            // If MongoDB deletion fails, you may want to handle rollback or cleanup operations
            return res.status(500).json({ message: 'Error deleting folder from MongoDB' });
        }

        res.status(200).json({ message: 'Folder deleted successfully' });
    } catch (error) {
        console.error('Internal server error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Delete a file
router.delete('/folder/:folderId/file/:fileId', authMiddleware, async (req, res) => {
    const { folderId, fileId } = req.params;

    if (!fileId) {
        return res.status(400).json({ message: 'File ID is required' });
    }

    try {
        // Find the folder by its ID and ensure it belongs to the current user
        const folder = await Folder.findOne({ _id: folderId, user: req.user._id });
        if (!folder) {
            return res.status(404).json({ message: 'Folder not found' });
        }

        // Find the file within the folder by its ID
        const file = folder.files.find(file => file._id.equals(fileId));
        if (!file) {
            return res.status(404).json({ message: 'File not found' });
        }

        console.log('Deleting file with driveFileId:', file.driveFileId); // Log the driveFileId

        // Delete file from Google Drive
        await drive.files.delete({
            fileId: file.driveFileId,
        });

        // Remove the file from the files array
        folder.files = folder.files.filter(f => !f._id.equals(fileId));

        // Save the folder document to persist the changes
        await folder.save();

        res.status(200).json({ message: 'File deleted successfully' });
    } catch (error) {
        console.error('Error deleting file:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});


// Get all files in a specific folder
router.get('/folder/:folderId/files', authMiddleware, async (req, res) => {
    const { folderId } = req.params;
    const userId = req.user._id;

    try {
        // Find the parent folder by its ID and ensure it belongs to the current user
        const parentFolder = await Folder.findOne({ _id: folderId, user: userId });
        if (!parentFolder) {
            return res.status(404).json({ message: 'Folder not found' });
        }

        // Return only file details (name and URL)
        const files = parentFolder.files.map(file => ({
            id: file._id,
            name: file.name,
            url: file.url, // Assuming this is where the file is stored
        }));

        res.status(200).json(files);
    } catch (error) {
        console.error('Error fetching files:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

module.exports = router;
