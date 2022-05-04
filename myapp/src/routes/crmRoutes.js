import { addNewContact, getContacts, checkLogin, addNewOrder, checkSignup, getOrderInfo, getWarehouseID, UPS_GoPickUp, returnWorldID, returnStatus, Request_Classify_ups, Request_Classify, sendpackageDelivered,sendtruckArrived } from "../controllers/crmControllers"
const routes = (app) => {
     
    app.route('/contact')
        .get((req,res, next) => {
            // middleware
            console.log(`Request from: ${req.originalUrl}`)
            console.log(`Request type: ${req.method}`)
            next();
        }, getContacts)
        
        .post(addNewContact)

    app.route('/contact/:contactID')
        .put((req, res)=>
        res.send('PUT resquest successful!'))

        .delete((req, res)=>
        res.send('DELETE resquest successful!'))

    app.route('/login')
    .post(checkLogin)
    
    app.route('/personal')
    .get(getOrderInfo)
    
    app.route('/signup')
    .post(checkSignup)

    app.route('/amazonEndpoint')
    .post(Request_Classify)

    app.route('/upsEndpoint')
    .post(Request_Classify_ups)


    app.route('/testtruckArrived')
    .post(sendtruckArrived)

    app.route('/testpackageDelivered')
    .post(sendpackageDelivered)

    // app.route('/startDelivery')
    // .post(addNewOrder)

    app.route('/worldid')
    .get(returnWorldID)

    // app.route('/deliveryStatus')
    // .post(returnStatus)

    // app.route('/truckArrived')
    // .post(returnGotit)

    // app.route('/getWarehouseID')
    // .get(getWarehouseID, UPS_GoPickUp)





}

export default routes;