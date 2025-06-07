import { registerRootComponent } from 'expo';
import App from './src/App';

// Register the main component
registerRootComponent(App);

// If you're not using Expo, you would use this instead:
// import {AppRegistry} from 'react-native';
// import App from './src/App';
// import {name as appName} from './app.json';
// 
// AppRegistry.registerComponent(appName, () => App);