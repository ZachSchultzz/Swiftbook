import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../AuthContext';

interface TimeCard {
  _id: string;
  userId: string;
  businessId: string;
  date: string;
  hoursWorked: number;
  description: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  updatedAt?: string;
}

const TimeCards: React.FC = () => {
  const { token, role, userId } = useAuth();
  const [timeCards, setTimeCards] = useState<TimeCard[]>([]);
  const [newTimeCard, setNewTimeCard] = useState({ date: '', hoursWorked: '', description: '' });
  const [message, setMessage] = useState('');

  useEffect(() => {
    console.log('TimeCards useEffect - Token and userId:', { token, userId }); // Debug log
    if (token) {
      fetchTimeCards();
    } else {
      console.log('No token available, skipping fetchTimeCards'); // Debug log
    }
  }, [token]);

  const fetchTimeCards = async () => {
    try {
      console.log('Fetching time cards with token:', token); // Debug log
      const response = await axios.get('http://localhost:3001/api/timecards', {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log('Time cards response:', response.data); // Debug log
      setTimeCards(response.data);
    } catch (err: any) {
      setMessage(err.response?.data?.message || 'Error fetching time cards');
      console.error('Error fetching time cards:', err.response?.data || err.message); // Debug log
    }
  };

  const handleSubmitTimeCard = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      console.log('Submitting time card:', newTimeCard); // Debug log
      const response = await axios.post('http://localhost:3001/api/timecards', newTimeCard, {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log('Submit time card response:', response.data); // Debug log
      setMessage(response.data.message);
      setNewTimeCard({ date: '', hoursWorked: '', description: '' });
      fetchTimeCards();
    } catch (err: any) {
      setMessage(err.response?.data?.message || 'Error submitting time card');
      console.error('Error submitting time card:', err.response?.data || err.message); // Debug log
    }
  };

  const handleApproveReject = async (timeCardId: string, status: 'approved' | 'rejected') => {
    try {
      console.log(`Updating time card ${timeCardId} to status: ${status}`); // Debug log
      const response = await axios.put(
        `http://localhost:3001/api/timecards/${timeCardId}`,
        { status },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      console.log('Update time card response:', response.data); // Debug log
      setMessage(response.data.message);
      fetchTimeCards();
    } catch (err: any) {
      setMessage(err.response?.data?.message || 'Error updating time card');
      console.error('Error updating time card:', err.response?.data || err.message); // Debug log
    }
  };

  return (
    <div>
      <h3>Time Cards</h3>
      <h4>Submit a Time Card</h4>
      <form onSubmit={handleSubmitTimeCard}>
        <div>
          <label>Date:</label>
          <input
            type="date"
            value={newTimeCard.date}
            onChange={(e) => setNewTimeCard({ ...newTimeCard, date: e.target.value })}
            required
          />
        </div>
        <div>
          <label>Hours Worked:</label>
          <input
            type="number"
            step="0.1"
            value={newTimeCard.hoursWorked}
            onChange={(e) => setNewTimeCard({ ...newTimeCard, hoursWorked: e.target.value })}
            required
          />
        </div>
        <div>
          <label>Description:</label>
          <textarea
            value={newTimeCard.description}
            onChange={(e) => setNewTimeCard({ ...newTimeCard, description: e.target.value })}
          />
        </div>
        <button type="submit">Submit Time Card</button>
      </form>
      {message && <p>{message}</p>}

      <h4>Time Card List</h4>
      {timeCards.length > 0 ? (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ border: '1px solid #ccc', padding: '8px' }}>Date</th>
              <th style={{ border: '1px solid #ccc', padding: '8px' }}>Hours Worked</th>
              <th style={{ border: '1px solid #ccc', padding: '8px' }}>Description</th>
              <th style={{ border: '1px solid #ccc', padding: '8px' }}>Status</th>
              <th style={{ border: '1px solid #ccc', padding: '8px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {timeCards.map((timeCard) => (
              <tr key={timeCard._id}>
                <td style={{ border: '1px solid #ccc', padding: '8px' }}>
                  {new Date(timeCard.date).toLocaleDateString()}
                </td>
                <td style={{ border: '1px solid #ccc', padding: '8px' }}>{timeCard.hoursWorked}</td>
                <td style={{ border: '1px solid #ccc', padding: '8px' }}>{timeCard.description}</td>
                <td style={{ border: '1px solid #ccc', padding: '8px' }}>{timeCard.status}</td>
                <td style={{ border: '1px solid #ccc', padding: '8px' }}>
                  {role && ['manager', 'admin', 'owner'].includes(role) && timeCard.status === 'pending' ? (
                    <>
                      <button onClick={() => handleApproveReject(timeCard._id, 'approved')}>
                        Approve
                      </button>
                      <button
                        onClick={() => handleApproveReject(timeCard._id, 'rejected')}
                        style={{ marginLeft: '10px' }}
                      >
                        Reject
                      </button>
                    </>
                  ) : (
                    'N/A'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>No time cards found.</p>
      )}
    </div>
  );
};

export default TimeCards;