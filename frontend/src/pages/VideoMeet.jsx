import React, { useState, useRef, useEffect } from 'react';
import { io } from "socket.io-client";
import { IconButton,TextField, Button } from "@mui/material";
import VideocamIcon from '@mui/icons-material/Videocam';
import VideocamOffIcon from '@mui/icons-material/VideocamOff';
import styles from "../styles/VideoMeetComponent.module.css"
import CallEndIcon from '@mui/icons-material/CallEnd'
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import ScreenShareIcon from '@mui/icons-material/ScreenShare';
import StopScreenShareIcon from '@mui/icons-material/StopScreenShare';
import ChatIcon from '@mui/icons-material/Chat'
import Badge from "@mui/material/Badge";
const server_url = "http://localhost:8000";

var connections = {};

const peerConfigConnections = {
    "iceServers": [
        {"urls": "stun:stun.l.google.com:19302"}
    ]
}

export default function VideoMeetComponent() {

  var socketRef = useRef();
  let socketIdRef = useRef();

  let localVideoRef = useRef();

  let [videoAvailable, setVideoAvailable] = useState(true);

  let [audioAvailable, setAudioAvailable] = useState(true);

  let [video, setVideo] = useState([]);

  let [audio, setAudio] = useState();

  let [screen, setScreen] = useState();

  let [showModal, setModal] = useState(true);

  let [screenAvailable, setScreenAvailable] = useState();

  let [messages, setMessages] = useState([]);

  let [message, setMessage] = useState("");

  let [newMessages, setNewMessages] = useState(3);

  let [askForUsername, setAskForUsername] = useState(true);

  let [username, setUsername] = useState("");

  const videoRef = useRef([])

  let [videos, setVideos] = useState([])
//TODO
//   if(isChrome() == false){

//   }
const getPermissions = async () => {
  try{
    const videoPermission = await navigator.mediaDevices.getUserMedia({video: true});

    if(videoPermission){
      setVideoAvailable(true);
    }else{
      setVideoAvailable(false);
    }

    const audioPermission = await navigator.mediaDevices.getUserMedia({audio: true});

    if(audioPermission){
      setAudioAvailable(true);
    }else{
      setAudioAvailable(false);
    }

    if(navigator.mediaDevices.getDisplayMedia){
      setScreenAvailable(true);
    }else{
      setScreenAvailable(false);
    }

    if(videoAvailable || audioAvailable){
      const userMediaStream = await navigator.mediaDevices.getUserMedia({video: videoAvailable, audio: audioAvailable});

      if(userMediaStream){
        window.localStream = userMediaStream;
        if(localVideoRef.current){
          localVideoRef.current.srcObject = userMediaStream;
        }
      }
    }
  }catch(err){
      console.log(err);
  }
  }
useEffect(() => {
    getPermissions();
}, [])

let getUserMediaSucess = (stream) => {
  try{
    window.localStream.getTracks().forEach(track => track.stop())
  }catch(e) {console.log(e)}

  window.localStream = stream;
  localVideoRef.current.srcObject = stream;

  for(let id in connections){
    if(id == socketIdRef.current) continue;

    window.localStream.getTracks().forEach(track => {
      connections[id].addTrack(track, window.localStream);
    });
    

    connections[id].createOffer().then((description)=>{
      connections[id].setLocalDescription(description)
      .then(() => {
        socketRef.current.emit("signal", id, JSON.stringify({"sdp": connections[id].localDescription}))
      })
      .catch(e => console.log(e))
    })
  }
  stream.getTracks().forEach(track => track.onended = () => {
    setVideo(false);
    setAudio(false);

    try{
      let tracks = localVideoRef.current.srcObject.getTracks()
      tracks.forEach(track => track.stop())
    }catch (e) {console.log(e)}

    
    let blackSilence = (...args) => new MediaStream([black(...args), silenece()])
    window.localStream = blackSilence();
    localVideoRef.current.srcObject = window.localStream;

    for(let id in connections){
      connections[id].addStream(window.localStream)
      connections[id].createOffer().then((description)=>{
        connections[id].setLocalDescription(description)
        .then(()=>{
          socketRef.current.emit("signal", id, JSON.stringify({"sdp": connections[id]}))
        }).catch(e => console.log(e));
      })
    }
  })
}
let silence = () => {
  let ctx = new AudioContext()
  let oscillator = ctx.createOscillator();

  let dst = oscillator.connect(ctx.createMediaStreamDestination());

  oscillator.start();
  ctx.resume()
  return Object.assign(dst.stream.getAudioTracks()[0], {enabled: false});
}

let black = ({width= 640, height= 480} = {}) => {
  let canvas = Object.assign(document.createElement("canvas"), {width, height});

  canvas.getContext('2d').fillRect(0, 0, width, height);
  let stream = canvas.captureStream();
  return Object.assign(stream.getVideoTracks()[0], {enabled: false})
}

let getUserMedia = () => {
  if((video && videoAvailable) || (audio && audioAvailable)){
    navigator.mediaDevices.getUserMedia({ video: video, audio: audio })
    .then(getUserMediaSucess)
    .catch((e) => console.log("Error accessing media devices:", e));  
  }else{
    try{
        let tracks = localVideoRef.current.srcObject.getTracks();
        tracks.forEach(track => track.stop())
    }catch(e){}
  }
}

useEffect(() => {
  if(video != undefined && audio != undefined){
    getUserMedia();
  }
}, [audio, video])

//TODO
let gotMessageFromServer = (fromId, message) => {
  var signal = JSON.parse(message)

  if(fromId !== socketIdRef.current){
    if(signal.sdp){
      connections[fromId].setRemoteDescription(new RTCSessionDescription(signal.sdp)).then(() =>{
        if(signal.sdp.type == "offer"){
          connections[fromId].createAnswer().then((description) => {
            connections[fromId].setLocalDescription(description).then(()=>{
              socketRef.current.emit("signal", fromId, JSON.stringify({"sdp": connections[fromId].localDescription}));
            }).catch(e => console.log(e))
          }).catch(e=>console.log(e))
        }
      }).catch(e=>console.log(e))
    }
    if(signal.ice){
      connections[fromId].addIceCandidate(new RTCIceCandidate(signal.ice)).catch(e=>console.log(e));
    }
  }
} 
//TODO addMessage
let addMessage = () => {

}

let connectToSocketServer = () => {
  socketRef.current = io.connect(server_url, {secure: false})

  socketRef.current.on('signal', gotMessageFromServer);

  socketRef.current.on("connect", () => {
    socketRef.current.emit("join-call", window.location.href)

    socketIdRef.current = socketRef.current.id

    socketRef.current.on("chat-message", addMessage)

    socketRef.current.on("user-left", (id)=>{
       setVideo((videos) => videos.filter((video)=> video.socketId != id))
    })

    socketRef.current.on("user-joined", (id, clients) => {
      clients.forEach((socketListId)=>{

        connections[socketListId] = new RTCPeerConnection(peerConfigConnections)

        connections[socketListId].onicecandidate = (event) => {
          if(event.candidate != null){
            socketRef.current.emit("signal", socketListId, JSON.stringify({'ice': event.candidate}))
          }
        }

        connections[socketListId].onaddstream = (event) => {

          let videoExists = videoRef.current.find(video => video.socketId == socketListId);

          if(videoExists){
            setVideo(videos => {
              const updatedVideos = videos.map(video => 
                video.socketId == socketListId ? {...video, stream: event.stream} : video
              );
              videoRef.current = updatedVideos;
              return updatedVideos;
            })
          }else{
            let newVideo = {
              socketId: socketListId,
              stream: event.stream,
              autoPlay: true,
              playsinline: true
            }

            setVideos(videos=>{
              const updatedVideos = [...videos, newVideo];
              videoRef.current = updatedVideos;
              return updatedVideos;
            });
          }

        };

        if(window.localStream !== undefined && window.localStream !== null){
          connections[socketListId].addStream(window.localStream);
        }else{
          //TODO BLACKSILENECE
          //let blacksilence

          let blackSilence = (...args) => new MediaStream([black(...args), silence()])
          window.localStream = blackSilence();
          connections[socketListId].addStream(window.localStream);
        }

      })

      if(id == socketIdRef.current){
        for(let id2 in connections){
          if(id2 == socketIdRef.current) continue

          try{
            connections[id2].addStream(window.localStream)
          }catch(e){ }

          connections[id2].createOffer().then((description) => {
              connections[id2].setLocalDescription(description)
              .then(()=>{
                socketRef.current.emit("signal", socketListId, JSON.stringify({"sdp": connections[id2].localDescription}))
              })
              .catch(e=>console.log(e))
          })
        }
      }
    })
  })
}

let getMedia = () => {
  setVideo(videoAvailable);
  setAudio(audioAvailable);
  connectToSocketServer();
}

let connect = () => {
  setAskForUsername(false);
  getMedia();
}

let handleVideo = () => {
  setVideo(!video);
}

let handleAudio = () => {
  setAudio(!audio);
}
let getDisplayMediaSuccess = (stream) => {
    try{
      window.localStream.getTracks().forEach(track=> track.stop())
    }catch (e) {console.log(e)}

    window.localStream = stream;
    localVideoRef.current.srcObject = stream;

    for(let id in connections){
      if(id == socketIdRef.current) continue;

      connections[id].addStream(window.localStream)
      connections[id].createOffer().then((description)=>{
        connections[id].setLocalDescription(description)
        .then(()=>{
          socketIdRef.current.emit("signal", id, JSON.stringify({"sdp":connections[id].localDescription}))
        })
        .catch(e => console.log(e))
      })
    }
}
let getDisplayMedia = () => {
  if(screen){
    if(navigator.mediaDevices.getDisplayMedia){
      navigator.mediaDevices.getDisplayMedia({video: true, audio: true})
      .then(getDisplayMediaSuccess)
      .then((stream)=>{})
      .catch((e)=> console.log(e))
    }
  }
}

useEffect(()=>{
  if(screen != undefined){
    getDisplayMedia();
  }
})

let handleScreen = () => {
  setScreen(!screen);
}
let sendMessage = () => {
  
}


  return (
    <div>
        {askForUsername == true ?
            <div>
                
                <h2>Enter into Lobby</h2>
                <TextField id="outlined-basic" label="Username" value={username} onChange={e => setUsername(e.target.value)} variant="outlined" />
                <Button variant="contained" onClick={connect}>Connect</Button>

            <div>
              <video ref={localVideoRef} autoPlay muted></video>
            </div>
            </div> : 
            <div className={styles.meetVideoContainer}>
              {showModal ?  <div className={styles.chatRoom}>
                  <div className={styles.chatContainer}>
                     <h1>Chat</h1>

                    <div className={styles.chattingArea}>
                       <TextField id="outlined-basic" label="Enter your chat" variant="outlined" />
                       <Button variant='contained' onClick={sendMessage}>Send</Button>
                    </div>
                  </div>
              </div>:<></> }
            

              <div className={styles.buttonContainers}>
                  <IconButton onClick={handleVideo} style={{color: "white", fontSize: "32px"}}>
                    {(video==true)? <VideocamIcon/> : <VideocamOffIcon/>}
                  </IconButton>
                  <IconButton style={{color: "red"}}>
                     <CallEndIcon/>
                  </IconButton>
                  <IconButton onClick={handleAudio} style={{color:"white"}}>
                      {audio==true ? <MicIcon/> : <MicOffIcon/>}
                  </IconButton>
                  {screenAvailable == true ?
                  <IconButton onClick={handleScreen} style={{color: "white"}}>
                    {screen==true ? <ScreenShareIcon/>: <StopScreenShareIcon/>}
                  </IconButton>:<></>}

                  <Badge badgeContent={newMessages} max={999} color='secondary'>
                    <IconButton onClick={() => setModal(!showModal)} style={{color:"white"}}>
                       <ChatIcon/>
                    </IconButton>
                  </Badge>
              </div>
              <video className={styles.meetUserVideo} ref={localVideoRef} autoPlay muted></video>
              {videos.map((video)=>(
                <div className={styles.conferenceView} key={video.socketId}>
                    <h2>{video.socketId}</h2>

                    <video
                    data-socket={video.socketId}
                    ref={ref=>{
                      if(ref && video.stream){
                        ref.srcObject = video.stream;
                      }
                    }}
                    autoPlay
                  ></video>
                </div>
              ))}
            </div>
        }
    </div>
  )
} 