import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, Animated, Easing, AppState, AppStateStatus } from 'react-native';
import { FAB, useTheme } from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';
import AppointmentManager from './AppointmentManager';
import analytics from '@react-native-firebase/analytics';
import { RootStackParamList } from './_layout';
import { useNavigation, RouteProp, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { FontAwesome5 } from '@expo/vector-icons';

interface Appointment {
    id: string;
    title: string;
    startTime: string;
    endTime: string;
}

interface MeetingControlsScreenProps {
    isMuted?: boolean;
    isPaused?: boolean;
    appointment?: Appointment;
    collapseSheet?: () => void;
}

type MeetingControlsScreenRouteProp = RouteProp<RootStackParamList, 'MeetingControlsScreen'>;

const MeetingControlsScreen: React.FC<MeetingControlsScreenProps> = () => {
    const route = useRoute<MeetingControlsScreenRouteProp>();
    const { isMuted = false, isPaused = false, appointment, collapseSheet } = route.params || {};
    const theme = useTheme();
    const [muted, setMuted] = useState(isMuted);
    const [paused, setPaused] = useState(isPaused);
    const animatedValue = useState(new Animated.Value(0))[0];
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>(); //

    useEffect(() => {
        const initializeRecording = async () => {
            try {
                if (appointment) {
                    AppointmentManager.uploadChunksPeriodically();
                    await AppointmentManager.startRecording(appointment.id);
                }
            } catch (error) {
                console.error('Error initializing recording:', error);
            }
        };
    
        if (appointment) {
            initializeRecording();
        }
    
        return () => {
        };
    }, [appointment]);
    

    useEffect(() => {
        const handleAppStateChange = (nextAppState: AppStateStatus) => {
            if (nextAppState === 'active') {
                console.log('App has come to the foreground!');
                analytics().logEvent('app_state_change', { state: 'foreground' });
    
                // Check if the current screen is not already MeetingControlsScreen
                const currentRoute = navigation.getState().routes[navigation.getState().index];
                if (appointment && currentRoute.name !== 'MeetingControlsScreen') {
                    navigation.navigate('MeetingControlsScreen', {
                        appointment,
                        isMuted: muted,
                        isPaused: paused,
                        collapseSheet
                    });
                }
            } else if (nextAppState.match(/inactive|background/)) {
                console.log('App is in the background');
                analytics().logEvent('app_state_change', { state: 'background' });
            }
        };
    
        const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);
    
        return () => {
            if (appStateSubscription) {
                appStateSubscription.remove();
            }
        };
    }, [appointment, muted, paused, collapseSheet, navigation]);    

    const handleToggle = (setter: React.Dispatch<React.SetStateAction<boolean>>, value: boolean) => {
        setter(!value);
        Animated.timing(animatedValue, {
            toValue: value ? 0 : 1,
            duration: 300,
            easing: Easing.linear,
            useNativeDriver: false,
        }).start();
    };

    const handleMuteToggle = async () => {
        const newMutedState = !muted;
        handleToggle(setMuted, muted);
        await AppointmentManager.pauseRecording();

        if (!newMutedState && !paused) {
            await AppointmentManager.resumeRecording();
        }

        console.log('Mute button pressed, isMuted:', newMutedState);

        // Log the event for mute toggle
        analytics().logEvent('mute_toggle', {
            component: 'MeetingControlsScreen',
            appointmentId: appointment?.id,
            status: newMutedState ? 'muted' : 'unmuted'
        });
    };

    const handlePauseToggle = async () => {
        const newPausedState = !paused;
        handleToggle(setPaused, paused);
        await AppointmentManager.pauseRecording();

        if (!muted && !newPausedState) {
            await AppointmentManager.resumeRecording();
        }

        console.log('Pause button pressed, isPaused:', newPausedState);

        // Log the event for pause toggle
        analytics().logEvent('pause_toggle', {
            component: 'MeetingControlsScreen',
            appointmentId: appointment?.id,
            status: newPausedState ? 'paused' : 'resumed'
        });
    };

    const handleEndMeeting = async () => {
        await AppointmentManager.stopRecording();
        console.log('End Meeting button pressed');
        if (collapseSheet) {
            collapseSheet();
        }
        navigation.navigate('DrawerNavigator');

        // Log the event for ending the meeting
        analytics().logEvent('end_meeting', {
            component: 'MeetingControlsScreen',
            appointmentId: appointment?.id,
            status: 'ended'
        });
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>{appointment?.title}</Text>
            <View style={styles.profileContainer}>
                <View style={styles.profileImageWrapper}>
                    <FontAwesome5 name="comments" size={50} color="#ffffff" />
                </View>
            </View>
            <View style={styles.controlGroup}>
                <View style={styles.controls}>
                    {/* <FAB
                        icon={muted ? "microphone-off" : "microphone"}
                        label={muted ? "Unmute" : "Mute"}
                        onPress={handleMuteToggle}
                        style={[styles.fab, styles.fabMutePause, muted && styles.fabToggled]}
                        color={muted ? 'red' : theme.colors.primary}
                    /> */}
                    {/* <FAB
                        icon={paused ? "play" : "pause"}
                        label={paused ? "Resume" : "Pause"}
                        onPress={handlePauseToggle}
                        style={[styles.fab, styles.fabMutePause, paused && styles.fabToggled]}
                        color={paused ? 'red' : theme.colors.primary}
                    /> */}
                </View>
                <FAB
                    icon="phone-hangup"
                    label="End Appointment"
                    onPress={handleEndMeeting}
                    style={styles.endMeetingFab}
                    color="white"
                    uppercase={false}
                />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#303030',
        paddingVertical: 80,
    },
    title: {
        fontSize: 24,
        color: '#fff',
        marginBottom: 20,
        textAlign: 'center',
    },
    profileContainer: {
        position: 'relative',
        marginBottom: 20,
        marginTop: 40,
    },
    profileImageWrapper: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#505050',
        justifyContent: 'center',
        alignItems: 'center',
    },
    controlGroup: {
        width: '80%',
        alignItems: 'center',
        marginBottom: 20,
    },
    controls: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 20,
        paddingHorizontal: 10,
    },
    fab: {
        borderWidth: 2,
        borderColor: 'transparent',
        backgroundColor: '#303030',
    },
    fabMutePause: {
        flex: 1,
        marginHorizontal: 5,
        borderColor: '#303030',
        borderWidth: 2,
        backgroundColor: '#303030',
    },
    fabToggled: {
        borderColor: 'red',
        backgroundColor: 'rgba(255, 0, 0, 0.1)',
    },
    endMeetingFab: {
        backgroundColor: '#d32f2f',
        height: 60,
        width: '100%',
        justifyContent: 'center',
        alignSelf: 'stretch',
        paddingVertical: 10,
    },
});

export default MeetingControlsScreen;
