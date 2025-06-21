import Settings from '../models/Settings.js';

// Get the single settings document
export const getSettings = async (req, res) => {
  try {
    const settings = await Settings.findOne();
    if (!settings) return res.status(404).json({ message: 'Settings not found' });
    res.json(settings);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Create or update the single settings document
export const upsertSettings = async (req, res) => {
  try {
    const settings = await Settings.findOneAndUpdate(
      {}, // No filter, so it updates the first (and only) document
      req.body,
      { new: true, upsert: true }
    );
    res.json(settings);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// Delete the single settings document
export const deleteSettings = async (req, res) => {
  try {
    const settings = await Settings.findOneAndDelete({});
    if (!settings) return res.status(404).json({ message: 'Settings not found' });
    res.json({ message: 'Settings deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};