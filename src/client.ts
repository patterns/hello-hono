
var firebase = require('firebase');
var firebaseui = require('firebaseui');


// Initialize the FirebaseUI Widget using Firebase.
var ui = new firebaseui.auth.AuthUI(firebase.auth());

var uiConfig = {
  // Will use popup for IDP Providers sign-in flow instead of the default, redirect.
  signInFlow: 'popup',
  signInSuccessUrl: 'https://www.adafruit.com/',
  signInOptions: [
    {
      provider: firebase.auth.GoogleAuthProvider.PROVIDER_ID,
      clientId: process.env.FIREBASE_AUTH_CLIENT_ID,
      scopes: [
        'https://www.googleapis.com/auth/contacts.readonly'
      ],
    }
  ],
  credentialHelper: firebaseui.auth.CredentialHelper.GOOGLE_YOLO
};

// The start method will wait until the DOM is loaded.
ui.start('#firebaseui-auth-container', uiConfig);

