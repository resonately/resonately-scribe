// MeetingControls.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { FAB } from 'react-native-paper';
import Timer from '@/components/Timer';
import analytics from '@react-native-firebase/analytics';

interface MeetingControlsProps {
    isMuted: boolean;
    isMeetingStarted: boolean;
    initialStartTime: number | null;
    handleMuteToggle: () => void;
    handleEndCall: () => void;
}

const MeetingControls: React.FC<MeetingControlsProps> = ({
    isMuted,
    isMeetingStarted,
    initialStartTime,
    handleMuteToggle,
    handleEndCall,
}) => {
    const handleMutePress = () => {
        handleMuteToggle();
        analytics().logEvent('toggle_mute', {
            page: 'meeting_controls',
            element_type: 'button',
            event_type: 'on_click',
            is_muted: isMuted,
        });
    };

    const handleEndPress = () => {
        handleEndCall();
        analytics().logEvent('end_call', {
            page: 'meeting_controls',
            element_type: 'button',
            event_type: 'on_click',
        });
    };

    return (
        <View style={styles.meetingControls}>
            <FAB
                style={styles.muteButton}
                icon={isMuted ? "microphone-off" : "microphone"}
                onPress={handleMutePress}
                color={isMuted ? "red" : "black"}
            />
            <View style={styles.timerContainer}>
                <Timer isPaused={isMuted} isRunning={isMeetingStarted} initialStartTime={initialStartTime} />
            </View>
            <FAB
                style={[styles.fab, styles.endVisitButton]}
                icon="stop"
                onPress={handleEndPress}
                label="End Visit"
                color="red"
            />
        </View>
    );
};

const styles = StyleSheet.create({
    meetingControls: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        width: '90%',
        marginTop: 20,
    },
    muteButton: {
        backgroundColor: 'white',
        borderColor: 'gray',
        borderWidth: 1,
        color: 'black',
        borderRadius: 50,
        justifyContent: 'center',
        alignItems: 'center',
        width: '20%',
        marginVertical: 0,
        marginBottom: 20,
        paddingHorizontal: 0,
    },
    timerContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        width: '50%',
        marginBottom: 20,
        paddingHorizontal: 0,
    },
    fab: {
        height: 56,
        marginBottom: 50,
        paddingHorizontal: 20,
    },
    endVisitButton: {
        width: '40%',
        backgroundColor: 'white',
        justifyContent: 'center',
        marginBottom: 20,
        paddingHorizontal: 0,
    },
});

export default MeetingControls;
