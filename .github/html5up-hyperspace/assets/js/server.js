// server.js
const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const app = express();

app.use(express.json());

// Route pour créer un client
app.post('/create-customer', async (req, res) => {
    try {
        const {
            email,
            name
        } = req.body;
        const customer = await stripe.customers.create({
            email,
            name
        });
        res.json({
            customer
        });
    } catch (error) {
        res.status(500).send({
            error: error.message
        });
    }
});
// server.js

// Route pour confirmer un paiement
app.post('/confirm-payment', async (req, res) => {
    const {
        paymentIntentId,
        token
    } = req.body;
    try {
        const paymentIntent = await stripe.paymentIntents.confirm(
            paymentIntentId, {
                payment_method: token
            }
        );
        res.json({
            success: true
        });
    } catch (error) {
        res.status(500).send({
            error: error.message
        });
    }
});
// server.js

// Route pour créer un abonnement
app.post('/create-subscription', async (req, res) => {
    const {
        customerId,
        priceId
    } = req.body; // priceId est l'ID du prix défini dans votre tableau de bord Stripe
    try {
        const subscription = await stripe.subscriptions.create({
            customer: customerId,
            items: [{
                price: priceId
            }],
            expand: ['latest_invoice.payment_intent'],
        });
        res.json({
            subscription
        });
    } catch (error) {
        res.status(500).send({
            error: error.message
        });
    }
});
// server.js
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

// Route pour recevoir les événements Stripe
app.post('/webhook', express.raw({
    type: 'application/json'
}), (req, res) => {
    const sig = req.headers['stripe-signature'];

    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
        console.log('Webhook signature verification failed.');
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Gérer l'événement
    if (event.type === 'payment_intent.succeeded') {
        const paymentIntent = event.data.object; // Contient des informations sur l'objet PaymentIntent
        console.log(`PaymentIntent for ${paymentIntent.amount} was successful!`);
    }

    // Répondre au webhook
    res.status(200).send('Event received');
});
// server.js

// Route pour annuler un abonnement
app.post('/cancel-subscription', async (req, res) => {
    const {
        subscriptionId
    } = req.body;
    try {
        const subscription = await stripe.subscriptions.del(subscriptionId);
        res.json({
            subscription
        });
    } catch (error) {
        res.status(500).send({
            error: error.message
        });
    }
});
// server.js

// Liste des clients
app.get('/customers', async (req, res) => {
    try {
        const customers = await stripe.customers.list();
        res.json(customers);
    } catch (error) {
        res.status(500).send({
            error: error.message
        });
    }
});

// Liste des abonnements
app.get('/subscriptions', async (req, res) => {
    try {
        const subscriptions = await stripe.subscriptions.list();
        res.json(subscriptions);
    } catch (error) {
        res.status(500).send({
            error: error.message
        });
    }
});

// Liste des paiements
app.get('/payments', async (req, res) => {
    try {
        const payments = await stripe.paymentIntents.list();
        res.json(payments);
    } catch (error) {
        res.status(500).send({
            error: error.message
        });
    }
});
require('dotenv').config();
const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const app = express();

app.use(express.json());

// Créer un client
app.post('/create-customer', async (req, res) => {
    try {
        const {
            email,
            name
        } = req.body;
        const customer = await stripe.customers.create({
            email,
            name
        });
        res.json({
            customer
        });
    } catch (error) {
        res.status(500).send({
            error: error.message
        });
    }
});

// Créer une intention de paiement
app.post('/create-payment-intent', async (req, res) => {
    const {
        amount,
        currency
    } = req.body;
    try {
        const paymentIntent = await stripe.paymentIntents.create({
            amount,
            currency
        });
        res.json({
            clientSecret: paymentIntent.client_secret
        });
    } catch (error) {
        res.status(500).send({
            error: error.message
        });
    }
});

// Webhook pour recevoir des notifications de Stripe
app.post('/webhook', express.raw({
    type: 'application/json'
}), (req, res) => {
    const sig = req.headers['stripe-signature'];

    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'payment_intent.succeeded') {
        const paymentIntent = event.data.object;
        console.log(`PaymentIntent for ${paymentIntent.amount} was successful!`);
    }

    res.status(200).send('Event received');
});

app.listen(3000, () => {
    console.log("Le serveur Stripe fonctionne sur le port 3000");
});
require('dotenv').config();
const express = require('express');
const xero = require('xero-node');
const session = require('express-session');

const app = express();

// Configuration de l'authentification OAuth2
const oauth2 = new xero.OAuth2({
    clientId: process.env.XERO_CLIENT_ID,
    clientSecret: process.env.XERO_CLIENT_SECRET,
    redirectUri: process.env.XERO_REDIRECT_URI
});

app.use(session({
    secret: 'votre-secret-session',
    resave: false,
    saveUninitialized: true
}));

// Route pour initier la connexion avec Xero
app.get('/xero-login', (req, res) => {
    const authUrl = oauth2.buildAuthUrl();
    res.redirect(authUrl);
});

// Callback Xero pour l'authentification
app.get('/xero-callback', async (req, res) => {
    try {
        const tokenSet = await oauth2.getToken(req.query.code);
        req.session.xeroTokenSet = tokenSet;
        res.redirect('/dashboard');
    } catch (error) {
        res.status(500).send('Erreur lors de la récupération du token Xero');
    }
});

// Route pour récupérer les factures Xero
app.get('/xero-invoices', async (req, res) => {
    if (!req.session.xeroTokenSet) {
        return res.redirect('/xero-login');
    }

    try {
        oauth2.setToken(req.session.xeroTokenSet);
        const xeroClient = new xero.XeroClient({
            oauth2: oauth2
        });
        const invoices = await xeroClient.invoices.get();
        res.json(invoices);
    } catch (error) {
        res.status(500).send('Erreur lors de la récupération des factures Xero');
    }
});

app.listen(3000, () => {
    console.log("API Xero en écoute sur le port 3000");
});
// server.js
require('dotenv').config();
const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY); // Assurez-vous d'avoir la clé secrète Stripe dans votre .env
const app = express();

// Middleware pour parser les requêtes en JSON
app.use(express.json());

// Route pour créer une intention de paiement
app.post('/create-payment-intent', async (req, res) => {
    const {
        amount,
        currency
    } = req.body;

    try {
        // Crée une intention de paiement Stripe
        const paymentIntent = await stripe.paymentIntents.create({
            amount, // Montant en centimes (par exemple, 500 pour 5.00 EUR)
            currency
        });

        // Renvoie le client secret à l'utilisateur
        res.send({
            clientSecret: paymentIntent.client_secret
        });
    } catch (error) {
        res.status(500).send({
            error: error.message
        });
    }
});

app.listen(3000, () => {
    console.log("Le serveur Stripe fonctionne sur le port 3000");
});