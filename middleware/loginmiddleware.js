const Auth = require('../model/authModel');
const bcrypt = require('bcryptjs');

const loginMiddleware = async (req, res, next) => {
    const { email, password } = req.body;
    try {
        const user = await Auth.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'User not found' });
        }
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(400).json({ message: 'Invalid password' });
        } else if (!user.verified) {
            return res.status(400).json({ message: 'Account not verified' });
        }
        req.user = user;
        next();
    } catch (error) {
        console.error('Error logging in:', error);
        res.status(500).json({ message: 'Error logging in' });
    }
};

module.exports = loginMiddleware;
