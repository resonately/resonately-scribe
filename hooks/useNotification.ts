import { useState, useEffect, useRef } from "react";
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { NotificationMessage } from "@/app/types";

Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
});

async function registerForPushNotificationsAsync() {
    let token;
  
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }
  
    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') {
        alert('Failed to get push token for push notification!');
        return;
      }

      try {
        // change the project ID
        const projectId = 'b65b67c1-3ab7-4ebe-9482-76c8c9f064c6';
        if (!projectId) {
          throw new Error('Project ID not found');
        }
        token = (
          await Notifications.getExpoPushTokenAsync({
            projectId,
          })
        ).data;
        console.log(token);
      } catch (e) {
        token = `${e}`;
      }
    } else {
      alert('Must use physical device for Push Notifications');
    }
  
    return token;
}  

const useNotifications = () => {

    const [channels, setChannels] = useState<Notifications.NotificationChannel[]>([]);
    const [notification, setNotification] = useState<Notifications.Notification | undefined>(
        undefined
    );

    const notificationListener = useRef<Notifications.Subscription>();
    const responseListener = useRef<Notifications.Subscription>();

    useEffect(() => {
        registerForPushNotificationsAsync().then(async (token) => {
            console.log("Token: ", token);
            const existingToken = await AsyncStorage.getItem('expoPushToken');
            if(token && token !== existingToken) {
                await AsyncStorage.setItem('expoPushToken', token);
            }
        });
    
        if (Platform.OS === 'android') {
          Notifications.getNotificationChannelsAsync().then(value => setChannels(value ?? []));
        }
        notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
          setNotification(notification);
        });
    
        responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
          console.log(response);
        });
    
        return () => {
          notificationListener.current &&
            Notifications.removeNotificationSubscription(notificationListener.current);
          responseListener.current &&
            Notifications.removeNotificationSubscription(responseListener.current);
        };
    }, []);

};

export const sendNotification = async ({ title, body }: NotificationMessage) => {
    const url = `https://exp.host/--/api/v2/push/send`;

    const expoPushToken = await AsyncStorage.getItem('expoPushToken');

    // notification message
    const message = {
        to: expoPushToken,
        sound: 'default',
        title: title,
        body: body,
    }

    try {
        await fetch(url, {
            method: "POST",
            headers: {
                host: "exp.host",
                accept: "application/json",
                "accept-encoding": "gzip, deflate",
                "content-type": "application/json"
            },
            body: JSON.stringify(message)
        })
    } catch (err) {
        console.log("Error sending notification: ", err);
    }
}

export default useNotifications;