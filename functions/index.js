const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

const app = require('express')();

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

app.post('/screams', (req, res) => {
    const newScreams = {
        body: req.body.body,
        userHandle: req.body.userHandle,
        craetedAt: new Date().toISOString()
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

exports.api = functions.region('asia-east2').https.onRequest(app);