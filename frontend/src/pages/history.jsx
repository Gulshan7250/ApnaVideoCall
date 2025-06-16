import React, { useEffect, useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom'; 
import { AuthContext } from '../contexts/AuthContext';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
export default function History() {

const {getHistoryOfUser} = useContext(AuthContext);

const [meetings, setMeetings] = useState([])

const routeTo = useNavigate();

useEffect(()=>{
    const fetchHistory = async () => {
        try {
            const history = await getHistoryOfUser();
            setMeetings(history);
            }catch{
                //Implement snackbar
            }
        }

        fetchHistory();
    }, [])
  return (
    <div>
        {
            meetings.map(e=>{
                return(
                    <>
                        <Card variant="outlined">{card}</Card>
                    </>
                )
            })
        }
    </div>
  )
}

