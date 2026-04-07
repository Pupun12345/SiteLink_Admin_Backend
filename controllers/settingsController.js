const User = require('../models/User');

exports.getProfile=async(req,res)=>{
    try {
        
        const user=await User.findById(req.user._id).select("name email profileImage");

        if(!user || user.userType!=="admin"){
            return res.status(404).json({message:"Admin not found"});
        }

        return res.status(200).json({user});    


    } catch (error) {
        return res.status(500).json({ message: 'Internal server error' });
    }
}

exports.updateProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);

        if (!user || user.userType !== 'admin') {
            return res.status(404).json({ message: 'Admin not found' });
        }

        const { name, email } = req.body;
        if (!name || !email) {
            return res.status(400).json({ message: 'Name and email are required' });
        }

        if(req.files?.profileImage){
            const profileImage=req.files.profileImage[0].path;
            await User.findByIdAndUpdate(req.user._id, { profileImage }, { new: true });
        }

        await User.findByIdAndUpdate(req.user._id, { name, email }, { new: true });
        return res.status(200).json({ message: 'Profile updated successfully' });

    } catch (error) {
        return res.status(500).json({ message: 'Internal server error' });
    }
}

exports.changePassword = async (req, res) => {
    try {

        const user = await User.findById(req.user._id).select('+password');

        if (!user || user.userType !== 'admin') {
            return res.status(404).json({ message: 'Admin not found' });
        }

        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ message: 'Current and new password are required' });
        }

        const isPasswordCorrect = await user.comparePassword(currentPassword);
        if (!isPasswordCorrect) {
            return res.status(400).json({ message: 'Current password is incorrect' });
        }

    
        user.password = newPassword;
        await user.save();
        
        res.status(200).json({ message: 'Password changed successfully' });


    } catch (error) {
        return res.status(500).json({ message: 'Internal server error' });
    }
}