import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Text, Keyboard, TouchableWithoutFeedback, ActivityIndicator, Alert, Image } from 'react-native';
import BottomSheet from '@gorhom/bottom-sheet';
import { TextInput, Button, List, useTheme } from 'react-native-paper';
import { DatePickerModal, TimePickerModal } from 'react-native-paper-dates';
import { en, registerTranslation } from 'react-native-paper-dates';
import { format } from 'date-fns';
import { createAppointment } from './RecordUtils';
import { useAuth } from './AuthContext';
import Timer from '@/components/Timer';
import Constants from 'expo-constants';
import MeetingControls from './MeetingControls';
import analytics from '@react-native-firebase/analytics';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from './_layout';
// Import the necessary types

const API_BASE_URL = Constants.expoConfig?.extra?.API_BASE_URL ?? 'https://api.rsn8ly.xyz';

registerTranslation('en', en);

// Update CreateMeetingSheetProps to include the navigation prop type
interface CreateMeetingSheetProps {
    bottomSheetRef: React.RefObject<BottomSheet>;
    isSheetOpen: boolean;
    setIsSheetOpen: (isOpen: boolean) => void;
    refreshAppointments: () => void;
    event?: {
        id?: string;
        title: string;
        start: string;
        end: string;
        patient_name?: string;
        appointment_type?: string;
    };
    handleJoinMeeting: (appointmentId: string) => void;
    handleMuteToggle: () => void;
    handleEndCall: () => void;
    isMuted: boolean;
    isMeetingStarted: boolean;
    initialStartTime: number | null;
    setAppointmentId: (id: string) => void;
    navigation: NativeStackNavigationProp<RootStackParamList>;
    collapseSheet: () => void;
}

const CreateMeetingSheet: React.FC<CreateMeetingSheetProps> = ({
    bottomSheetRef,
    isSheetOpen,
    setIsSheetOpen,
    refreshAppointments,
    event,
    handleJoinMeeting,
    handleMuteToggle,
    handleEndCall,
    setAppointmentId,
    isMuted,
    isMeetingStarted,
    initialStartTime,
    navigation,
    collapseSheet
}) => {
    const theme = useTheme();
    const { tenantName } = useAuth().tenantDetails;
    const [appointmentType, setAppointmentType] = useState('');
    const [suggestedTypes, setSuggestedTypes] = useState<string[]>([]);
    const [patientName, setPatientName] = useState('');
    const [providerName, setProviderName] = useState('');
    const [startDate, setStartDate] = useState<Date | undefined>(new Date());
    const [startTime, setStartTime] = useState<{ hours: number, minutes: number }>({ hours: new Date().getHours(), minutes: new Date().getMinutes() });
    const [endDate, setEndDate] = useState<Date | undefined>(new Date(Date.now() + 60 * 60 * 1000));
    const [endTime, setEndTime] = useState<{ hours: number, minutes: number }>({ hours: new Date(Date.now() + 60 * 60 * 1000).getHours(), minutes: new Date(Date.now() + 60 * 60 * 1000).getMinutes() });
    const [showStartDatePicker, setShowStartDatePicker] = useState(false);
    const [showStartTimePicker, setShowStartTimePicker] = useState(false);
    const [showEndDatePicker, setShowEndDatePicker] = useState(false);
    const [showEndTimePicker, setShowEndTimePicker] = useState(false);
    const [loading, setLoading] = useState(false);
    const [currentAppointmentId, setCurrentAppointmentId] = useState<string | null>(null);
    const appointmentIdRef = useRef<string | null>(null);
    const [creatingAppointment, setCreatingAppointment] = useState(false);
    const [showMeetingControls, setShowMeetingControls] = useState(false);

    useEffect(() => {
        if (isSheetOpen) {
            bottomSheetRef.current?.expand();
            analytics().logEvent('open_bottom_sheet', {
                element_type: 'bottom_sheet',
                event_type: 'on_open',
            });
            if (!event) {
                setStartDate(new Date());
                setEndDate(new Date(Date.now() + 60 * 60 * 1000));
                setStartTime({ hours: new Date().getHours(), minutes: new Date().getMinutes() });
                setEndTime({ hours: new Date(Date.now() + 60 * 60 * 1000).getHours(), minutes: new Date(Date.now() + 60 * 60 * 1000).getMinutes() });
            }
        } else {
            bottomSheetRef.current?.close();
            analytics().logEvent('close_bottom_sheet', {
                element_type: 'bottom_sheet',
                event_type: 'on_close',
            });
        }
    }, [isSheetOpen]);

    useEffect(() => {
        if (event) {
            setAppointmentType(event.appointment_type || '');
            setPatientName(event.patient_name || '');
            const startDateTime = new Date(event.start);
            const endDateTime = new Date(event.end);
            setStartDate(startDateTime);
            setEndDate(endDateTime);
            setStartTime({ hours: startDateTime.getHours(), minutes: startDateTime.getMinutes() });
            setEndTime({ hours: endDateTime.getHours(), minutes: endDateTime.getMinutes() });
            setCurrentAppointmentId(event.id || null);
            appointmentIdRef.current = event.id || null;
        } else {
            setAppointmentType('');
            setPatientName('');
            setStartDate(new Date());
            setEndDate(new Date(Date.now() + 60 * 60 * 1000));
            setStartTime({ hours: new Date().getHours(), minutes: new Date().getMinutes() });
            setEndTime({ hours: new Date(Date.now() + 60 * 60 * 1000).getHours(), minutes: new Date(Date.now() + 60 * 60 * 1000).getMinutes() });
            setCurrentAppointmentId(null);
        }
    }, [event]);

    const handleJoinMeetingWrapper = () => {
        if (appointmentIdRef.current) {
            navigation.navigate('MeetingControlsScreen', {
                appointment: {
                    id: appointmentIdRef.current,
                    title: event?.title || 'New Appointment',
                    startTime: '2024-07-07T10:00:00Z',
                    endTime: '2024-07-07T11:00:00Z'
                },
                collapseSheet
            });
            analytics().logEvent('join_meeting', {
                page: 'appointment',
                element_type: 'button',
                event_type: 'on_click',
            });
        } else {
            Alert.alert('Appointment ID missing.');
            analytics().logEvent('join_meeting_failure', {
                page: 'appointment',
                element_type: 'alert',
                event_type: 'on_display',
            });
        }
    };

    const handleCreateMeeting = async (startNow: boolean = true) => {
        analytics().logEvent('start_appointment_now', {
            page: 'appointment',
            element_type: 'button',
            event_type: 'on_click',
        });
        if (!startDate || !endDate) {
            Alert.alert('Error', 'Please select date and time for the appointment.');
            analytics().logEvent('missing_date_time', {
                page: 'appointment',
                element_type: 'alert',
                event_type: 'on_display',
            });
            return;
        }

        const startDateTime = new Date(
            startDate.getFullYear(),
            startDate.getMonth(),
            startDate.getDate(),
            startTime.hours,
            startTime.minutes
        );

        const endDateTime = new Date(
            endDate.getFullYear(),
            endDate.getMonth(),
            endDate.getDate(),
            endTime.hours,
            endTime.minutes
        );

        setLoading(true);
        setCreatingAppointment(true);

        try {
            let appointmentTitle = event?.title || '';
            let appointmentId = '';

            const response = await createAppointment(appointmentType, patientName, appointmentTitle, startDateTime.toUTCString(), endDateTime.toUTCString(), '', tenantName);
            if (response.success) {
                if (response.appointmentId) {
                    appointmentId = response.appointmentId;
                }
                setAppointmentId(appointmentId);
                setCurrentAppointmentId(appointmentId);
                appointmentIdRef.current = appointmentId;
                refreshAppointments();

                // Set meeting controls before joining the meeting
                if (startNow) {
                    handleJoinMeetingWrapper();
                }
            } else {
                throw new Error('Failed to create appointment');
            }

        } catch (error) {
            Alert.alert('Error', 'Failed to create appointment');
            analytics().logEvent('create_appointment_error', {
                page: 'appointment',
                element_type: 'alert',
                event_type: 'on_display',
            });
        } finally {
            setLoading(false);
            setCreatingAppointment(false);
            if (!startNow) {
                setIsSheetOpen(false);
                setCurrentAppointmentId(null);
                analytics().logEvent('appointment_scheduled', {
                    page: 'appointment',
                    element_type: 'button',
                    event_type: 'on_click',
                });
            }
        }
    };

    const fetchSuggestedTypes = async (query: string) => {
        const response = await fetch(`${API_BASE_URL}/appointment-types?q=${query}`);
        const data = await response.json();
        setSuggestedTypes(data);
    };

    const formatDate = (date: Date) => {
        return format(date, 'MMMM dd yyyy');
    };

    const formatTime = (hours: number, minutes: number) => {
        return format(new Date(0, 0, 0, hours, minutes), 'hh:mm a');
    };

    return (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <BottomSheet
                ref={bottomSheetRef}
                index={-1}
                snapPoints={['100%']}
                enablePanDownToClose={!isMeetingStarted}
                onChange={(index) => {
                    if (index === -1) {
                        setIsSheetOpen(false);
                        setCurrentAppointmentId(null);
                        appointmentIdRef.current = null;
                        analytics().logEvent('close_bottom_sheet', {
                            element_type: 'bottom_sheet',
                            event_type: 'on_close',
                        });
                    }
                }}
            >
                <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                    <View style={[styles.bottomSheet, { backgroundColor: theme.colors.background }]}>
                        <View style={styles.header}>
                            <Text style={styles.bottomSheetTitle}>{event ? event.title : 'New Appointment'}</Text>
                        </View>
                        <TextInput
                            label="Select Appointment Type (Optional)"
                            value={appointmentType}
                            onChangeText={(text) => {
                                setAppointmentType(text);
                                fetchSuggestedTypes(text);
                            }}
                            mode="outlined"
                            style={styles.input}
                            onFocus={() => fetchSuggestedTypes('')}
                            disabled={!!event}
                            right={<TextInput.Icon name="chevron-down" />}
                        />
                        {suggestedTypes.length > 0 && (
                            <List.Section>
                                {suggestedTypes.map((type) => (
                                    <List.Item
                                        key={type}
                                        title={type}
                                        onPress={() => {
                                            setAppointmentType(type);
                                            setSuggestedTypes([]);
                                            analytics().logEvent('select_appointment_type', {
                                                page: 'appointment',
                                                element_type: 'list_item',
                                                event_type: 'on_select',
                                                appointment_type: type,
                                            });
                                        }}
                                    />
                                ))}
                            </List.Section>
                        )}
                        <TextInput
                            label="Add Patient (Optional)"
                            value={patientName}
                            onChangeText={setPatientName}
                            mode="outlined"
                            style={styles.input}
                            disabled={!!event}
                            right={<TextInput.Icon name="chevron-down" />}
                        />
                        <TextInput
                            label="Add Providers (Coming soon)"
                            value={providerName}
                            onChangeText={setProviderName}
                            disabled={true}
                            mode="outlined"
                            style={styles.input}
                            right={<TextInput.Icon name="chevron-down" />}
                        />
                        <View style={styles.row}>
                            <TextInput
                                label="Start Date"
                                value={startDate ? formatDate(startDate) : ''}
                                onFocus={() => setShowStartDatePicker(true)}
                                mode="outlined"
                                style={[styles.input, styles.halfInput]}
                                disabled={!!event}
                            />
                            <DatePickerModal
                                locale="en"
                                visible={showStartDatePicker}
                                mode="single"
                                onDismiss={() => setShowStartDatePicker(false)}
                                date={startDate}
                                onConfirm={(params) => {
                                    setStartDate(params.date);
                                    setShowStartDatePicker(false);
                                    analytics().logEvent('select_start_date', {
                                        page: 'appointment',
                                        element_type: 'date_picker',
                                        event_type: 'on_select',
                                        start_date: params?.date?.toString(),
                                    });
                                }}
                            />
                            <TextInput
                                label="Start Time"
                                value={formatTime(startTime.hours, startTime.minutes)}
                                onFocus={() => setShowStartTimePicker(true)}
                                mode="outlined"
                                style={[styles.input, styles.halfInput]}
                                disabled={!!event}
                            />
                            <TimePickerModal
                                locale="en"
                                visible={showStartTimePicker}
                                onDismiss={() => setShowStartTimePicker(false)}
                                hours={startTime.hours}
                                minutes={startTime.minutes}
                                onConfirm={(params) => {
                                    setStartTime({ hours: params.hours, minutes: params.minutes });
                                    setShowStartTimePicker(false);
                                    analytics().logEvent('select_start_time', {
                                        page: 'appointment',
                                        element_type: 'time_picker',
                                        event_type: 'on_select',
                                        start_time: `${params.hours}:${params.minutes}`,
                                    });
                                }}
                            />
                        </View>
                        <View style={styles.row}>
                            <TextInput
                                label="End Date"
                                value={endDate ? formatDate(endDate) : ''}
                                onFocus={() => setShowEndDatePicker(true)}
                                mode="outlined"
                                style={[styles.input, styles.halfInput]}
                                disabled={!!event}
                            />
                            <DatePickerModal
                                locale="en"
                                visible={showEndDatePicker}
                                mode="single"
                                onDismiss={() => setShowEndDatePicker(false)}
                                date={endDate}
                                onConfirm={(params) => {
                                    setEndDate(params.date);
                                    setShowEndDatePicker(false);
                                    analytics().logEvent('select_end_date', {
                                        page: 'appointment',
                                        element_type: 'date_picker',
                                        event_type: 'on_select',
                                        end_date: params?.date?.toString(),
                                    });
                                }}
                            />
                            <TextInput
                                label="End Time"
                                value={formatTime(endTime.hours, endTime.minutes)}
                                onFocus={() => setShowEndTimePicker(true)}
                                mode="outlined"
                                style={[styles.input, styles.halfInput]}
                                disabled={!!event}
                            />
                            <TimePickerModal
                                locale="en"
                                visible={showEndTimePicker}
                                onDismiss={() => setShowEndTimePicker(false)}
                                hours={endTime.hours}
                                minutes={endTime.minutes}
                                onConfirm={(params) => {
                                    setEndTime({ hours: params.hours, minutes: params.minutes });
                                    setShowEndTimePicker(false);
                                    analytics().logEvent('select_end_time', {
                                        page: 'appointment',
                                        element_type: 'time_picker',
                                        event_type: 'on_select',
                                        end_time: `${params.hours}:${params.minutes}`,
                                    });
                                }}
                            />
                        </View>
                        {loading || creatingAppointment ? (
                            <ActivityIndicator size="large" color={theme.colors.primary} style={styles.loader} />
                        ) : (
                            <>
                                {!currentAppointmentId && !isMeetingStarted && (
                                    <>
                                        <Button
                                            mode="contained"
                                            onPress={() => {
                                                handleCreateMeeting();
                                                analytics().logEvent('start_appointment_now', {
                                                    page: 'appointment',
                                                    element_type: 'button',
                                                    event_type: 'on_click',
                                                });
                                            }}
                                            style={[styles.createMeetingButton, styles.centeredButton]}
                                            icon="calendar"
                                            contentStyle={styles.buttonContent}
                                            labelStyle={styles.buttonLabel}
                                        >
                                            Start Appointment Now
                                        </Button>
                                        <Button
                                            mode="outlined"
                                            onPress={() => {
                                                handleCreateMeeting(false);
                                                analytics().logEvent('schedule_appointment', {
                                                    page: 'appointment',
                                                    element_type: 'button',
                                                    event_type: 'on_click',
                                                });
                                            }}
                                            style={[styles.scheduleButton, styles.centeredButton]}
                                            icon="calendar-clock"
                                            contentStyle={styles.buttonContent}
                                            labelStyle={styles.buttonLabel}
                                        >
                                            Schedule for Later
                                        </Button>
                                    </>
                                )}
                                {!loading && !creatingAppointment && currentAppointmentId && !isMeetingStarted && !showMeetingControls && (
                                    <Button
                                        mode="contained"
                                        onPress={handleJoinMeetingWrapper}
                                        style={[styles.createMeetingButton, styles.centeredButton]}
                                        icon="calendar"
                                        contentStyle={styles.buttonContent}
                                        labelStyle={styles.buttonLabel}
                                    >
                                        Join Appointment
                                    </Button>
                                )}
                            </>
                        )}
                    </View>
                </TouchableWithoutFeedback>
            </BottomSheet>
        </TouchableWithoutFeedback>
    );    
};

const styles = StyleSheet.create({
    image: {
        width: 150,
        height: 150,
        marginBottom: 20,
    },
    // ... other styles
    scheduleButton: {
        width: '80%',
        height: 60,
        alignSelf: 'center',
        marginVertical: 10,
    },
    bottomSheet: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'flex-start',
        paddingBottom: 6,
        height: '100%',  // Ensure the bottom sheet covers the full height
        backgroundColor: 'white', // Add background color
    },
    bottomSheetTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 20,
        textAlign: 'center',
        width: '100%', // Ensure the text takes full width
        backgroundColor: 'white', // Add background color
        paddingHorizontal: 10, // Add padding to avoid cutting off
        flexWrap: 'wrap', // Ensure text wraps if too long
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'center', // Center the text
        alignItems: 'center',
        width: '100%',
        paddingHorizontal: 16,
        backgroundColor: 'white', // Add background color
    },
    input: {
        marginVertical: 10,
        width: '90%',
        backgroundColor: 'white', // Add background color
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '90%',
        alignItems: 'center',
        backgroundColor: 'white', // Add background color
    },
    halfInput: {
        width: '48%',
        backgroundColor: 'white', // Add background color
    },
    createMeetingButton: {
        width: '80%',
        height: 60,
        alignSelf: 'center',
        marginVertical: 20,
    },
    centeredButton: {
        alignSelf: 'center',
    },
    buttonContent: {
        height: 60,
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonLabel: {
        fontSize: 18,
    },
    joinMeetingButton: {
        marginTop: 20,
        marginBottom: 20,
        width: '90%',
        height: 60,
        justifyContent: 'center',
        alignSelf: 'center',
        alignItems: 'center',
        backgroundColor: 'white', // Add background color
    },
    joinMeetingButtonContent: {
        height: 60,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'white', // Add background color
    },
    joinMeetingButtonLabel: {
        fontSize: 18,
        width: '100%',
        textAlign: 'center',
    },
    loader: {
        marginTop: 20,
        backgroundColor: 'white', // Add background color
    },
    meetingControls: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        width: '90%',
        marginTop: 20,
        backgroundColor: 'white', // Add background color
    },
    muteButton: {
        backgroundColor: 'white', // Add background color
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
        backgroundColor: 'white', // Add background color
    },
    fab: {
        height: 56,
        marginBottom: 50,
        paddingHorizontal: 20,
        backgroundColor: 'white', // Add background color
    },
    endVisitButton: {
        width: '40%',
        backgroundColor: 'white', // Add background color
        justifyContent: 'center',
        marginBottom: 20,
        paddingHorizontal: 0,
    },
});

export default CreateMeetingSheet;
