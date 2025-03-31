import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../AuthContext';

interface ProfileData {
  name: string;
  email: string;
  phone: string;
  preferences: {
    theme: string;
    notifications: boolean;
  };
  role: string;
  businessId: string;
}

const Profile: React.FC = () => {
  const { token } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    preferences: { theme: 'light', notifications: true },
  });
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (token) {
      fetchProfile();
    }
  }, [token]);

  const fetchProfile = async () => {
    try {
      const response = await axios.get('http://localhost:3001/api/profile', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setProfile(response.data);
      setFormData({
        name: response.data.name,
        phone: response.data.phone,
        preferences: response.data.preferences,
      });
    } catch (err: any) {
      setMessage(err.response?.data?.message || 'Error fetching profile');
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await axios.put('http://localhost:3001/api/profile', formData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMessage(response.data.message);
      setProfile({ ...profile!, ...response.data.profile });
      setEditMode(false);
    } catch (err: any) {
      setMessage(err.response?.data?.message || 'Error updating profile');
    }
  };

  if (!profile) {
    return <p>Loading profile...</p>;
  }

  return (
    <div>
      <h3>Profile</h3>
      {message && <p>{message}</p>}
      {editMode ? (
        <form onSubmit={handleUpdateProfile}>
          <div>
            <label>Name:</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>
          <div>
            <label>Phone:</label>
            <input
              type="text"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
          </div>
          <div>
            <label>Theme:</label>
            <select
              value={formData.preferences.theme}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  preferences: { ...formData.preferences, theme: e.target.value },
                })
              }
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>
          <div>
            <label>Notifications:</label>
            <input
              type="checkbox"
              checked={formData.preferences.notifications}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  preferences: { ...formData.preferences, notifications: e.target.checked },
                })
              }
            />
          </div>
          <button type="submit">Save</button>
          <button type="button" onClick={() => setEditMode(false)}>
            Cancel
          </button>
        </form>
      ) : (
        <div>
          <p><strong>Name:</strong> {profile.name}</p>
          <p><strong>Email:</strong> {profile.email}</p>
          <p><strong>Phone:</strong> {profile.phone || 'Not set'}</p>
          <p><strong>Theme:</strong> {profile.preferences.theme}</p>
          <p><strong>Notifications:</strong> {profile.preferences.notifications ? 'Enabled' : 'Disabled'}</p>
          <p><strong>Role:</strong> {profile.role}</p>
          <p><strong>Business ID:</strong> {profile.businessId}</p>
          <button onClick={() => setEditMode(true)}>Edit Profile</button>
        </div>
      )}
    </div>
  );
};

export default Profile;