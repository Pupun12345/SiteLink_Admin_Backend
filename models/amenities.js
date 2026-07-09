const mongoose = require('mongoose');

const amenitySchema = new mongoose.Schema({
    id: {
        type: Number,
        required: true,
        unique: true
    },
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    category: {
        type: String,
        required: true,
        enum: [
            "Financial Benefits",
            "Accommodation & Food",
            "Travel",
            "Safety & Medical",
            "Leave",
            "Work & Career",
            "Employee Rewards",
        ],
    },
    icon: {
        type: String,
        default: null
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Amenities', amenitySchema);