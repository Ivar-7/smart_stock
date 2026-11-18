# Smart Stock — TODO

A system that forecasts product demand for small shops and tells them when to restock.

## Data

- [ ] Get sales data (real shop data, or fake realistic data)
- [ ] Clean the data
- [ ] Let user add sales (manual entry or file upload)
- [ ] Track current stock levels

## Forecasting

- [ ] Predict future demand per product
- [ ] Separate bulk purchases from normal sales
- [ ] Handle perishable vs non-perishable products
- [ ] Tag promotions / price changes so they don't mess up the forecast
- [ ] Detect unusual spikes/drops in sales
- [ ] Measure how accurate the forecast is

## Restocking

- [ ] Alert the owner before a product runs out
- [ ] Recommend what to restock and how much
- [ ] Send notifications

## Dashboard

- [ ] Show forecasts
- [ ] Show alerts and restock recommendations
- [ ] Plain-English summaries of forecasts/alerts
- [ ] Easy enough for a non-technical shop owner

# Firebase credentials to be put in .env, DO NOT MAKE PUBLIC IN .env.example, make sure the .env is made

const firebaseConfig = {
apiKey: "AIzaSyD8tRy5ZTOicsHvyCE2h9OvenUzx8Gg-ws",
authDomain: "temp-2b00d.firebaseapp.com",
projectId: "temp-2b00d",
storageBucket: "temp-2b00d.firebasestorage.app",
messagingSenderId: "8281546310",
appId: "1:8281546310:web:bda107226b0122ea7ef447",
measurementId: "G-9396ZG6LFN"
};
