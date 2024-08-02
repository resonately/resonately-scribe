import { Audio } from 'expo-av';
import { mediaDevices, RTCPeerConnection, RTCIceCandidate } from 'react-native-webrtc';
import { KinesisVideo } from 'aws-sdk';
import { AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, AWS_STREAM_NAME } from '@env';

class AudioStreaming {
    private static instance: AudioStreaming;
    private recording: Audio.Recording | null = null;
    private kinesisVideo: KinesisVideo;
    private peerConnection: RTCPeerConnection;
    private mediaStream: MediaStream | null = null;

    private constructor() {
        console.log('Initializing AudioStreaming instance');

        // Initialize Kinesis Video Stream
        this.kinesisVideo = new KinesisVideo({
            region: AWS_REGION,
            accessKeyId: AWS_ACCESS_KEY_ID,
            secretAccessKey: AWS_SECRET_ACCESS_KEY
        });
        console.log('Kinesis Video Stream initialized');

        // Initialize WebRTC Peer Connection
        this.peerConnection = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        });
        console.log('WebRTC Peer Connection initialized');

        // Handle ICE candidates
        this.peerConnection.addEventListener('icecandidate', this.handleIceCandidate);
    }

    public static getInstance(): AudioStreaming {
        if (!AudioStreaming.instance) {
            AudioStreaming.instance = new AudioStreaming();
        }
        return AudioStreaming.instance;
    }

    private handleIceCandidate = (event: { candidate: RTCIceCandidate | null }) => {
        if (event.candidate) {
            // Handle the ICE candidate event (send to Kinesis or signaling server)
            console.log('New ICE candidate:', event.candidate);
        } else {
            console.log('All ICE candidates have been sent');
        }
    };

    public async startRecording() {
        if (this.recording) {
            console.warn("Already recording");
            return;
        }

        console.log('Requesting audio permissions');
        const { status } = await Audio.requestPermissionsAsync();
        if (status !== 'granted') {
            throw new Error('Audio permission not granted');
        }

        console.log('Permissions granted. Starting to record audio');
        try {
            // Create a MediaStream for WebRTC
            const stream = await mediaDevices.getUserMedia({ audio: true });
            this.mediaStream = stream as unknown as MediaStream;
            console.log('MediaStream created', this.mediaStream);

            // Add tracks to WebRTC Peer Connection
            stream.getTracks().forEach(track => {
                this.peerConnection.addTrack(track, stream);
                console.log('Track added to PeerConnection', track);
            });

            // Start streaming to Kinesis
            await this.startStreamingToKinesis();
        } catch (error) {
            console.error('Failed to start recording:', error);
        }
    }

    private async startStreamingToKinesis() {
        try {
            console.log('Getting Kinesis Video Stream data endpoint');
            const endpoint = await this.kinesisVideo.getDataEndpoint({
                StreamName: AWS_STREAM_NAME,
                APIName: 'PUT_MEDIA'
            }).promise();
            console.log('Data endpoint received', endpoint);

            // Example: use the endpoint to set up your streaming

            console.log('Creating offer for PeerConnection');
            const offer = await this.peerConnection.createOffer({});
            console.log('Offer created', offer);

            console.log('Setting local description for PeerConnection');
            await this.peerConnection.setLocalDescription(offer);
            console.log('Local description set');

            // Send offer to Kinesis Video Stream or signaling server
            console.log('Created offer sent to Kinesis Video Stream or signaling server');
        } catch (error) {
            console.error('Failed to start streaming to Kinesis:', error);
        }
    }

    public async stopRecording() {
        if (!this.mediaStream) {
            console.warn("Not recording");
            return;
        }

        console.log('Stopping all tracks in MediaStream');
        try {
            this.mediaStream.getTracks().forEach(track => {
                track.stop();
                console.log('Track stopped', track);
            });
            this.mediaStream = null;

            // Close WebRTC Peer Connection
            console.log('Closing PeerConnection');
            this.peerConnection.close();

            // Reinitialize the peer connection for next recording session
            console.log('Reinitializing PeerConnection for next recording session');
            this.peerConnection = new RTCPeerConnection({
                iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
            });
            this.peerConnection.addEventListener('icecandidate', this.handleIceCandidate);
            console.log('PeerConnection reinitialized');
        } catch (error) {
            console.error('Failed to stop recording:', error);
        }
    }
}

export default AudioStreaming.getInstance();
