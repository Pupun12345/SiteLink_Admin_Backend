const mongoose = require('mongoose');

const skillSchema = new mongoose.Schema({
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
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Skill', skillSchema);
