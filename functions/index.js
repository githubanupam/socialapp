const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();
const app = require('express')();

const firebaseConfig = {
    apiKey: "AIzaSyAUpaVvu3Zkmrj4l5radhI7_jsELLWD0HI",
    authDomain: "socialapp-ca2bd.firebaseapp.com",
    databaseURL: "https://socialapp-ca2bd.firebaseio.com",
    projectId: "socialapp-ca2bd",
    storageBucket: "socialapp-ca2bd.appspot.com",
    messagingSenderId: "1048044862801",
    appId: "1:1048044862801:web:250ef7911b3a6358"
};

const firebase = require('firebase');
firebase.initializeApp(firebaseConfig);

app.get('/screams', (req, res) => {
    admin.firestore().collection('screams').orderBy('createdAt', 'desc').get()
        .then(data => {
            let screams = [];
            data.forEach(doc => {
                screams.push({
                    screamId: doc.id,
                    body: doc.data().body,
                    userHandle: doc.data().userHandle,
                    craetedAt: doc.data().craetedAt
                });
            });
            return res.json(screams);
        })
        .catch(err => console.error(err));
});

const FBAuth = (req, res, next) => {
    let idToken;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
        idToken = req.headers.authorization.split('Bearer ')[1];
    } else {
        console.error('No token found');
        return res.status(403).json({ error: 'Unauthorized' });
    }
    admin.auth().verifyIdToken(idToken)
        .then(decodedToken => {
            req.user = decodedToken;
            console.log(decodedToken);
            return admin.firestore().collection('users')
                .where('userId', '==', req.user.uid)
                .limit(1)
                .get();
        })
        .then(data => {
            req.user.handle = data.docs[0].data().handle;
            return next();
        })
        .catch(err => {
            console.error('Error while verifying token', err);
            return res.status(403).json(err);
        })
};

app.post('/screams', FBAuth, (req, res) => {
    const newScreams = {
        body: req.body.body,
        userHandle: req.user.handle,
        createdAt: new Date().toISOString()
    };

    admin.firestore().collection('screams').add(newScreams)
        .then(doc => {
            res.json({ message: `document ${doc.id} created successfully` });
        })
        .catch(err => {
            console.error(err);
            res.status(500).json({ error: 'something went wrong' });
        })
});

let token, userId;

const isEmpty = (string) => {
    if (string.trim() === '') return true;
    else return false;
}

const isEmail = (email) => {
    const regEx = /^([0-9a-zA-Z]([-.\w]*[0-9a-zA-Z])*@([0-9a-zA-Z][-\w]*[0-9a-zA-Z]\.)+[a-zA-Z]{2,9})$/;
    if (email.match(regEx)) return true;
    else return false;
}

app.post('/signup', (req, res) => {
    const newUser = {
        email: req.body.email,
        password: req.body.password,
        confirmPassword: req.body.confirmPassword,
        handle: req.body.handle
    };

    let errors = {};

    if (isEmpty(newUser.email)) {
        errors.email = 'Email must not be empty';
    } else if (!isEmail(newUser.email)) {
        errors.email = 'Email address must be valid';
    }

    if (isEmpty(newUser.password)) {
        errors.password = 'Password must not be empty';
    }

    if (newUser.password !== newUser.confirmPassword) {
        errors.password = 'Passwords must be same';
    }

    if (isEmpty(newUser.handle)) {
        errors.handle = 'Handle must not be empty';
    }

    if (Object.keys(errors).length > 0) {
        return res.status(400).json(errors);
    }

    admin.firestore().doc(`/users/${newUser.handle}`).get()
        .then(doc => {
            if (doc.exists) {
                return res.status(400).json({ handle: 'this handle is already taken' });
            } else {
                return firebase.auth().createUserWithEmailAndPassword(newUser.email, newUser.password);
            }
        })
        .then(data => {
            userId = data.user.uid;
            return data.user.getIdToken();
        })
        .then(idToken => {
            token = idToken;
            const userCredentials = {
                handle: newUser.handle,
                email: newUser.email,
                createdAt: new Date().toISOString(),
                userId
            };
            return admin.firestore().doc(`/users/${newUser.handle}`).set(userCredentials);
        })
        .then(() => {
            return res.status(201).json({ token });
        })
        .catch(err => {
            console.error(err);
            if (err.code === 'auth/email-already-in-use') {
                return res.status(400).json({ email: 'Email is already in use' });
            } else {
                return res.status(500).json({ error: err.code });
            }

        })
});


app.post('/login', (req, res) => {
    const user = {
        email: req.body.email,
        password: req.body.password
    };

    let errors = {};

    if (isEmpty(user.email)) {
        errors.email = 'Email must not be empty';
    }
    if (isEmpty(user.password)) {
        errors.password = 'Password must not be empty';
    }

    if (Object.keys(errors).length > 0) {
        return res.status(400).json(errors);
    }

    firebase.auth().signInWithEmailAndPassword(user.email, user.password)
        .then(data => {
            return data.user.getIdToken();
        })
        .then(token => {
            return res.json({ token });
        })
        .catch(err => {
            console.error(err);
            if (err.code === 'auth/wrong-password') {
                return res.status(500).json({ general: 'Wrong credential, please try again' });
            } else {
                return res.status(500).json({ error: err.code });
            }
        })
});


exports.api = functions.region('asia-east2').https.onRequest(app);