const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const Auth = require('../model/authModel');
dotenv.config();

const authMiddleware = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Access Denied: No token provided' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await Auth.findOne({ email: decoded.email });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        req.user = user;
        next();
    } catch (error) {
        console.error('Error verifying token:', error);
        if (error.name === 'JsonWebTokenError') {
            return res.status(403).json({ message: 'Access Denied: Invalid token' });
        } else if (error.name === 'TokenExpiredError') {
            return res.status(403).json({ message: 'Access Denied: Token expired' });
        } else {
            return res.status(500).json({ message: 'Internal Server Error' });
        }
    }
};

module.exports = authMiddleware;