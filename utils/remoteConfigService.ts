import remoteConfig from '@react-native-firebase/remote-config';


export const fetchConfig = async () => {

    // await remoteConfig().setDefaults({
    //     is_resonately_remote_config_working: false,
    // });
    try {
        await remoteConfig().setConfigSettings({
            fetchTimeMillis: 10000, //10 seconds
            minimumFetchIntervalMillis: 10000, //10 seconds
        });
        await remoteConfig().fetch(0);
        await remoteConfig().fetchAndActivate();
    } catch (error) {
        console.log(">>> Error in remote fetchConfig", error);
    }
};

export const refreshConfig = async () => {
    try {
        await remoteConfig().fetchAndActivate();
    } catch(err) {
        console.log(">>> Error in refreshConfig", err);
    }
};


export const getRemoteValue = (key: string) => {
    try {
        const value = remoteConfig().getValue(key);
        return value.asString();
    } catch (error) {
        console.log(">>> Error in remote getRemoteValue", error);
        return null;
    }
};

export const getRemoteValueAsBoolean = (key: string) => {
    try {
        const value = remoteConfig().getValue(key);
        return value.asBoolean();
    } catch (error) {
        console.log(">>> Error in remote getRemoteValueAsBoolean", error);
        return false;
    }
};

export const getRemoteValueAsNumber = (key: string) => {
    try {
        const value = remoteConfig().getValue(key);
        return value.asNumber();
    } catch (error) {
        console.log(">>> Error in remote getRemoteValueAsNumber", error);
        return null;
    }
}
