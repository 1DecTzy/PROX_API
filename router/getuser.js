const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authmiddleware');
const Auth = require('../model/authModel')
router.get('/protected-route', authMiddleware, async (req, res) => {
    try {
        const user = await Auth.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        // Assuming 'avatar' is stored in the 'user' document
        const userData = {
            firstname: user.firstname,
            lastname: user.lastname,
            email: user.email,
            dob: user.dob,
            avatar: user.avatar // Ensure this is the correct field for avatar URL
        };
        res.json({ user: userData });
    } catch (error) {
        console.error('Error fetching user data:', error);
        res.status(500).json({ message: 'Error fetching user data' });
    }
});


module.exports = router;
