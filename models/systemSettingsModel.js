const mongoose = require('mongoose');

const systemSettingsSchema = new mongoose.Schema({
  // Registration period settings
  registrationPeriod: {
    startDate: {
      type: Date,
      default: null,
    },
    endDate: {
      type: Date,
      default: null,
    },
    enabled: {
      type: Boolean,
      default: false,
    }
  },
  
  // General settings
  universityName: {
    type: String,
    default: 'International Islamic University Chittagong'
  },
  currentSemester: {
    type: String,
    default: 'Spring 2025'
  },
  systemEmail: {
    type: String,
    default: 'crams@iiuc.ac.bd'
  },
  
  // Maintenance mode
  maintenanceMode: {
    type: Boolean,
    default: false
  },
  
  // Singleton pattern - only one settings document
  singleton: {
    type: Boolean,
    default: true,
    unique: true
  }
}, {
  timestamps: true
});

// Ensure only one settings document exists
systemSettingsSchema.statics.getSettings = async function() {
  let settings = await this.findOne({ singleton: true });
  if (!settings) {
    settings = await this.create({ singleton: true });
  }
  return settings;
};

module.exports = mongoose.model('SystemSettings', systemSettingsSchema);
