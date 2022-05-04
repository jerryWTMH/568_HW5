import mongoose from 'mongoose';
import { stringify } from 'querystring';
import { ContactSchema, OrderSchema , TruckSchema} from '../models/crmModels';

const protobuf = require('protobufjs');
const upsProto =  "world_ups.proto";
const amazonProto =  "world_amazon.proto";
const net = require('net');
const request = require('request');

var seqNum_global = 0;
var IDLETruck = [1];
var WORLD_ID = -1;
var TRACKING_NUM = 0;

const WORLD_SOCKET_UPS = net.createConnection({port: 12345, host: "vcm-26551.vm.duke.edu"});
const WORLD_SOCKET_AMAZON = net.createConnection({port: 23456, host: "vcm-26551.vm.duke.edu"});
SocketHandler();

const Contact = mongoose.model('Contact', ContactSchema);
const Order = mongoose.model('Order', OrderSchema);
const Truck = mongoose.model('Truck', TruckSchema);


class Queue {
    constructor() {
      this.elements = {};
      this.head = 0;
      this.tail = 0;
    }
    enqueue(element) {
      this.elements[this.tail] = element;
      this.tail++;
    }
    dequeue() {
      const item = this.elements[this.head];
      delete this.elements[this.head];
      this.head++;
      return item;
    }
    peek() {
      return this.elements[this.head];
    }
    get length() {
      return this.tail - this.head;
    }
    get isEmpty() {
      return this.length === 0;
    }
  }

  var packageWaitList = new Queue();


function SocketHandler(){
    WORLD_SOCKET_UPS.on('connect', () => {
        console.log("Socket: connect to world.");
        upsInitWorld();
        // const myTimeout = setTimeout(function () {
        //     amazomInitWorld();
        // }, 1000);
        
    });
    WORLD_SOCKET_UPS.on('data', (data) => {
        console.log("Socket: receive data from world.");
        handleUResponses(data);
    });
    WORLD_SOCKET_UPS.on('error', (error) => {
        console.log("Socket: some error from world.");
        console.log("Error: " + error.message);
    });
    WORLD_SOCKET_UPS.on('end', (end) => {
        console.log("Socket: end of the data");
    });

    WORLD_SOCKET_UPS.on('close', (disconnect) => {
        console.log("Socket: end of the data");
        WORLD_SOCKET_UPS.connect({port: 12345, host: "vcm-26551.vm.duke.edu"});
    });
}

export const addNewContact = (req, res) => {
    console.log("addNewContact");
    let newContact = new Contact(req.body);

    newContact.save((err, contact) => {
        if (err) {
            res.send(err);
        }
        res.json(contact);
    });
}

export const getContacts = (req, res) => {
    console.log("getContacts");
    Contact.find({}, (err, contact) => {
        if (err) {
            res.send(err);
        }
        res.json(contact);
    });
}

export const checkLogin = (req, res, next) => {
    console.log("checkLogin");
    Contact.findOne({"userid" : req.body.userid}, (err, contact) => {
    if(contact){
        if(contact.password == req.body.password){
            // Success
            //next(); 
            req.app.set('AAA', req.body.userid);
            res.redirect('/personal');           
        } else{
            // Password incorrect
            var text = "Your Password is incorrect!"
            res.render("../pages/login",{error: true, msg: text});
        }
    } else{
        // UserID incorrect
        var text = "Your UserID is incorrect!"
        res.render("../pages/login",{error: true, msg: text});
    }
    
    });
}

// This would be called by startDelivery from Amazon
// export const addNewOrder= (req, res) => {
//     console.log("addNewOrder");
//     let newOrder = new Order(req.body);

//     newOrder.save((err, contact) => {
//         if (err) {
//             res.send(err);
//         }
//         res.json(contact);
//     });
//}


//we should cancel the trackingNumber part in request...
export function addNewOrder(req, res){
    console.log("Status: in addNewOrder"); 
    
    let reqBody = JSON.parse(req.body);

    
    var current_trackingNumber = TRACKING_NUM;
    TRACKING_NUM++;
    let amazon_info = reqBody.startDelivery;

    let newOrder = new Order({"warehouseID": amazon_info.warehouseID,
                            "item": amazon_info.item,
                            "priority": 1,
                            "address": amazon_info.address,
                            "UPS_account":amazon_info.UPS_account,
                            "trackingNumber":current_trackingNumber,
                            "status": "non_pickup",
                            "priority":amazon_info.priority
                        });
    

    var whid_in = Number(amazon_info.warehouseID);
    //let tuple = Object.freeze([whid_in, current_trackingNumber]);
    packageWaitList.enqueue([whid_in,current_trackingNumber]);
    if (IDLETruck.length != 0){
        pickupHelper(IDLETruck.shift());
    }
    newOrder.save((err, contact) => {
        if (err) {
            res.send(JSON.stringify({"startDelivery":{'result':'error', 'trackingNumber': current_trackingNumber.toString()}}));
        }
        else{
            res.send(JSON.stringify({"startDelivery":{'result':'ok', 'trackingNumber': current_trackingNumber.toString()}}));
        }
    });    
}

export async function goDeliver(req, res){
    let reqBody = JSON.parse(req.body);
    let trac_num = reqBody.truckLoaded.trackingNumber;
 
    await Order.find({"trackingNumber": trac_num}, (err, contact) => {
        if(err){
            res.send(JSON.stringify({"truckLoaded":{'result' : "error", 'trackingNumber': trac_num.toString()}}));
        }
        if(contact){
            let OrderInfo = {"status" : "delivering"}; 
            updateStatusGoDeliver(OrderInfo,trac_num);
            res.send(JSON.stringify({"truckLoaded":{'result' : "ok", 'trackingNumber': trac_num.toString()}})); // Need to add more arguments
            console.log("contact[0] inside of goDeliver: " + contact[0]);
            var x = contact[0].address.split(',')[0];
            var y = contact[0].address.split(',')[1];
            UPS_GoDeliver(Number(trac_num), Number(x), Number(y));
        }
        else{
            res.send(JSON.stringify({"truckLoaded":{'result' : "error", 'trackingNumber': trac_num.toString()}}));
        }
    });

}

async function updateStatusGoDeliver(OrderInfo,trac_num){
    await Order.findOneAndUpdate({"trackingNumber" : trac_num}, OrderInfo);
}

// For the future!
// function afterCompletion(truck_id){
//     if(packageWaitList.size > 0){
//         pickupHelper(truck_id)
//     } else{
//         IDLETruck.add(truck_id);
//     }
// }

async function pickupHelper(truck_in){
    //var truck_in = IDLETruck.shift();
    let cur_job = packageWaitList.dequeue();
    // Inspect the Truck database, and check whether the trackingNumber for specific truck_id is exist?
    // if exist, just remove the old trackingNumber, and add new trackingNumber
    let TruckInfo = {'trackingNumber' : cur_job[1]};
    await Truck.findOneAndUpdate({"truck_id" : truck_in}, TruckInfo);
    // UPS_GoPickUp
    UPS_GoPickUp(cur_job[0], truck_in);
}




async function UPS_GoPickUp(whid_in, truck_id) {
    try{
        let root = await protobuf.load(upsProto);
        let UCommands = root.lookupType('UCommands');
        let UGoPickup = root.lookupType('UGoPickup');
            
        let UGoPickupPayload = {truckid: truck_id, whid: whid_in, seqnum: seqNum_global};

        console.log('UPS_GOpickup-> whid:' + UGoPickupPayload.whid.toString() + ', truckid:'+ UGoPickupPayload.truckid.toString());
        
        seqNum_global ++;
        var errMsg = UGoPickup.verify(UGoPickupPayload);
        if (errMsg) {
        console.log(errMsg);
        throw Error(errMsg);
        }
        let UCommandsPayload = {pickups: [UGoPickupPayload]};
        var errMsg = UCommands.verify(UCommandsPayload);
        if (errMsg) {
            console.log(errMsg);
            throw Error(errMsg);
        }
        let request = UCommands.create(UCommandsPayload);
        let buffer = UCommands.encodeDelimited(request).finish();
        WORLD_SOCKET_UPS.write(buffer);
        console.log('Send pickup to world');
        
    }
    catch(err){
        console.log(err);
    }
}



async function UPS_GoDeliver(trackingNumber, X, Y) {
    try{
        let root = await protobuf.load(upsProto);
        let UCommands = root.lookupType('UCommands');
        let UGoDeliver = root.lookupType('UGoDeliver');
        let UDeliveryLocation = root.lookupType('UDeliveryLocation');
        
            // need to access truck schema to get truckid
            Truck.find({"trackingNumber": trackingNumber}, (err, contact) => {
                if(contact){
                    var truck_id = contact[0].truckid;
                    //need help to get the address for a specific trackingNumber...
                    let UDeliveryLocationPayload = {packageid:trackingNumber, x:X, y:Y};
                    var errMsg = UDeliveryLocation.verify(UDeliveryLocationPayload);
                    if (errMsg) {
                    console.log(errMsg);
                    throw Error(errMsg);
                    }
                    let UGoDeliverPayload = {truckid:truck_id ,packages: [UDeliveryLocationPayload], seqnum: seqNum_global};
                    seqNum_global ++;
                    var errMsg = UGoDeliver.verify(UGoDeliverPayload);
                    if (errMsg) {
                    console.log(errMsg);
                    throw Error(errMsg);
                    }
                    
                    let UCommandsPayload = {deliveries: [UGoDeliverPayload]};
                    var errMsg = UCommands.verify(UCommandsPayload);
                    if (errMsg) {
                        console.log(errMsg);
                        throw Error(errMsg);
                    }
                    let request = UCommands.create(UCommandsPayload);
                    let buffer = UCommands.encodeDelimited(request).finish();
                    WORLD_SOCKET_UPS.write(buffer);
                    console.log('Send deliver to world');
                }
                else{
                    console.log("We cannot find the truck whose packages's trackingNumber is the same");
                }
            });


            
    }
    catch(err){
        console.log(err);
    }
}

async function UPS_Query(truckid) {
    try{
        let root = await protobuf.load(upsProto);
        let UCommands = root.lookupType('UCommands');
        let UQuery = root.lookupType('UQuery');
        
        let UQueryPayload = {truckid: truckid ,seqnum: seqNum_global};
        seqNum_global ++;
        var errMsg = UQuery.verify(UQueryPayload);
        if (errMsg) {
        console.log(errMsg);
        throw Error(errMsg);
        }
        
        let UCommandsPayload = {queries: [UQueryPayload]};
        var errMsg = UCommands.verify(UCommandsPayload);
        if (errMsg) {
            console.log(errMsg);
            throw Error(errMsg);
        }
        let request = UCommands.create(UCommandsPayload);
        let buffer = UCommands.encodeDelimited(request).finish();
        WORLD_SOCKET_UPS.write(buffer);
        console.log('Send queries to world');
    }
    catch(err){
        console.log(err);
    }
}

async function upsInitWorld() {
    try{
        let root = await protobuf.load(upsProto);
        let UConnectMessage = root.lookupType('UConnect');
        let UInitTruck = root.lookupType('UInitTruck');

        var UInitTruckPayload1 = {id: 1,  x: 9,  y: 12};
        // var UInitTruckPayload2 = {id: 2,  x: 10,  y: 11};
        // var UInitTruckPayload3 = {id: 3,  x: 12,  y: 13};

        for(let i = 0 ; i < IDLETruck.length; i++){
            let truck_info = {"truckid" : IDLETruck[i]};
            let cur_truck = new Truck(truck_info);
            cur_truck.save((err, contact) => {
                if (err) {
                    res.send(err);
                }
                if(contact){
                }  
            });
        }
        // add truck to IDLE truck list
        var errMsg = UInitTruck.verify(UInitTruckPayload1);
        if (errMsg) {
            console.log(errMsg);
            throw Error(errMsg);
        }
        let UConnectPayload = {trucks: [UInitTruckPayload1], isAmazon : false}
        errMsg = UConnectMessage.verify(UConnectPayload);
        if (errMsg) {
            console.log(errMsg);
        }
        
        let request = UConnectMessage.create(UConnectPayload);
        let buffer = UConnectMessage.encodeDelimited(request).finish();
        
        WORLD_SOCKET_UPS.write(buffer);
 
        console.log('Status: send UPS_init to world');
    }
    catch(err){
        console.log(err);
    }
}

async function amazomInitWorld() {
    try{
        let root = await protobuf.load(amazonProto);
        let AConnectMessage = root.lookupType('AConnect');
        let AInitWarehouse = root.lookupType('AInitWarehouse');

        var AInitWarehousePayload = {id: 1,  x: 7,  y: 8};
        // add warehouse to IDLE warehouse list
        var errMsg = AInitWarehouse.verify(AInitWarehousePayload);
        if (errMsg) {
            console.log(errMsg);
            throw Error(errMsg);
        }
        let AConnectPayload = {worldid: WORLD_ID, initwh: [AInitWarehousePayload], isAmazon : true}
        errMsg = AConnectMessage.verify(AConnectPayload);
        if (errMsg) {
            console.log(errMsg);
        }
        
        let request = AConnectMessage.create(AConnectPayload);
        let buffer = AConnectMessage.encodeDelimited(request).finish();

        WORLD_SOCKET_AMAZON.write(buffer);
 
        console.log('Status: send Amazon_init to world');
    }
    catch(err){
        console.log(err);
    }
}

async function handleUResponses(data){
    try{
        let root = await protobuf.load(upsProto);
        let UConnectedMessage = root.lookupType('UConnected');
        let decoded = UConnectedMessage.decodeDelimited(data);
        console.log("It is a UConnected");
        console.log(decoded.result);
        WORLD_ID = Number(decoded.worldid);
        console.log(WORLD_ID);
        // let root = await protobuf.load(amazonProto);
        // let AConnectedMessage = root.lookupType('AConnected');
        // let decoded = AConnectedMessage.decodeDelimited(data);
        // console.log("It is a AConnected");
        // console.log(decoded.result);
        // WORLD_ID = Number(decoded.worldid);
        // console.log(WORLD_ID);
    }
    catch(err){

        //add to database......
        let root = await protobuf.load(upsProto);

        let UResponses = root.lookupType('UResponses');
        let Ufinished = root.lookupType('UFinished');
        let UDeliveryMade = root.lookupType('UDeliveryMade');
        let UTruck = root.lookupType('UTruck');
        let UErr = root.lookupType('UErr');
       
        try{
            let decoded = UResponses.decodeDelimited(data);
            console.log(decoded.completions);
            //UFinished --> send truck arrived 
            if(decoded.completions.length != 0){
                let RF_truckid = decoded.completions[0].truckid;
                let RF_x = decoded.completions[0].x;
                let RF_y = decoded.completions[0].y;
                let RF_status = decoded.completions[0].status;
                let RF_seqnum = decoded.completions[0].seqnum;
                //getACK(RF_status);
                // need to find the truckid belongs to which tracking number from the database
                // send to Amazon truckArrived
                if (RF_status == "ARRIVE WAREHOUSE"){
                    await Truck.find({"truckid": RF_truckid}, (err, contact) => {
                        if (err) {
                            // Cannot find in the database (I guess)
                            res.send(err);
                        }
                        if(contact){
                            //
                            Order.updateOne({ "trackingNumber" : contact[0].trackingNumber}, {
                                "status" : "picked_up"
                            });
                            // Find at least one in the database
                            let post_data = JSON.stringify({"truckArrived":{"trackingNumber" : contact[0].trackingNumber, "truckid" : RF_truckid}});
                            console.log("__________________________________________");
                            console.log(post_data);
                            console.log("__________________________________________");
                            sentToAmazon(post_data);
                        }  
                    });
                }
                else{
                    if (!packageWaitList.isEmpty){
                        pickupHelper(RF_truckid);
                    }
                    else{
                        IDLETruck.add(RF_truckid);
                    }
                }

            }
        
        
            //UDeliveryMade --> 
            if(decoded.delivered.length != 0){
            
                let UD_truckid = decoded.delivered.truckid;
                let UD_packageid = decoded.delivered.packageid;
                let UD_seqnum = decoded.delivered.seqnum;

                //getACK(UD_seqnum);
                
                await Truck.find({"truckid": UD_truckid}, (err, contact) => {
                    if(err){
                        console.log("There is an error while accessing to the Truck Schema!");
                    }
                    if(contact){
                        let OrderInfo = {"status" : "delivered"};
                        UpdateDeliveryMade(OrderInfo,contact[0].trackingNumber);
                        let post_data = JSON.stringify({"packageDelivered":{"trackingNumber" : contact[0].trackingNumber}});
                        console.log("send package delivered:  "+post_data);
                        sentToAmazon(post_data);
                    }
                    else{
                        console.log("There is no truckid is found in Truck Schema!");
                    }


                });
                //sent to amazon: packageDelivered
            }

            //UTruck
            if(decoded.truckstatus.length != 0){
                let UT_truckid = decoded.truckstatus.truckid;
                let UT_status = decoded.truckstatus.status;
                let UT_x = decoded.truckstatus.x;
                let UT_y = decoded.truckstatus.y;
                let UT_seqnum = decoded.truckstatus.seqnum;
            }

            if(decoded.error.length != 0){
            //UErr
            let UE_err = decoded.error.err;
            let UE_originseqnum = decoded.error.originseqnum;
            let UE_seqnum = decoded.error.seqnum;
            //no finished ... for disconnect?
            }
        

            console.log("It is a UResponses");
            console.log(decoded);
        }
        catch(err){
            console.log(err);
        }
    }
    
    finally{
        console.log("Finally");
    }
}

async function UpdateDeliveryMade(OrderInfo,trackingNumber){
    await Order.findOneAndUpdate({"trackingNumber" : trackingNumber}, OrderInfo);
}

export const checkSignup= (req, res) => {
    console.log("checkSignup");
    Contact.findOne({"userid" : req.body.userid}, (err, contact) =>{
        if (err) {
            res.send(err);
        }
        if(contact){
            var repeat_reply = "This account has already been registered!";
            res.render("../pages/signup",{error: true, msg: repeat_reply});
        } else{
            delete req.body["re-password"];
            let newContact = new Contact(req.body);
            newContact.save((err, return_object) => {
                if (err) {
                    res.send(err);
                }
                res.render("../pages/index", return_object);
            });
        }

    });
}

export const getOrderInfo = (req, res) => {
    console.log("getOrderInfo");
    Order.find({"userid": req.app.get('AAA')}, (err, contact) => {
        if (err) {
            res.send(err);
        }
        if(contact){
            res.render('../pages/personal', {exist: true, userid: req.app.get('AAA'), orders: contact}); // Need to add more arguments
        }  
    });
}

// This would be called by the customer!
 async function editAddress(req, res){
     
    console.log("in editAddress");
    // console.log("trackingNumber: "+ req.body.trackingNumber);
    // console.log("address: " + req.body.editAddress);
    // console.log("userid: "+ req.app.get('AAA'));
    const userid = req.app.get('AAA');
    const update = {"address": reqBody.editAddress.address}
    await Order.findOneAndUpdate({"userid": userid, "trackingNumber" : reqBody.trackingNumber}, update); 
    req.app.set('AAA', userid);
    res.redirect('/personal');
}

async function editAddress2(req, res){
     
    console.log("in editAddress2");
    let reqBody = JSON.parse(req.body);
    let address = reqBody.editAddress.address;
    let track_num = reqBody.editAddress.trackingNumber;
    console.log("address in the editAddress2: " + address);
    
    
    await Order.find({"trackingNumber": track_num}, 'status' , (err, contact) => {      
        if(contact){
            try{
                console.log("In the line 599");
                if(contact[0].status == "non_pickup" || contact[0].status == "picked up"){
                    console.log("In the line 601");
                    updateAddress(address, track_num);
                    
                    res.send(JSON.stringify({"editAddress":{"result":  "yes", "trackingNumber":track_num.toString()}}));
                }
                else{
                    res.send(JSON.stringify({"editAddress":{"result":  "error", "trackingNumber":track_num.toString()}}));
                }
            }
            catch(err){
                console.log("There is an error happens in editAddress2");
            }
        } else{
            console.log("There is no trackingNumber in the Database");
        }
    });
}
    
async function updateAddress(address, track_num){
        try{
            const update = {"address": address};
            await Order.findOneAndUpdate({"trackingNumber": track_num}, update);
        }
        catch(err){
            console.log(err);
        }
    }

async function cancelAddress(req,res){
    let reqBody = JSON.parse(req.body);
    let track_num = reqBody.cancelAddress.trackingNumber;
    console.log("in cancelAddress");
    const update = {"status": "cancel"};
    await Order.findOneAndUpdate({"trackingNumber": track_num}, update); 
    res.send(JSON.stringify({"cancelAddress":{"result":  "yes", "trackingNumber":track_num.toString()}}));
}

export const returnWorldID = async(req, res) =>{
    console.log("In worldID......");
    res.send(JSON.stringify({"worldid" : WORLD_ID.toString()}));
}

export function returnStatus(req, res){
    let reqBody = JSON.parse(req.body);
    let trackNum = reqBody.deliveryStatus.trackingNumber;
    Order.find({"trackingNumber": trackNum}, 'status' , (err, contact) => {
        
        if(contact){
            try{
            res.send(JSON.stringify({"deliveryStatus":{'status' : contact[0].status.toString(), 'trackingNumber': trackNum.toString()}})); // Need to add more arguments
            }
            catch(err){
                res.send("no such trackingNumber");
            }
        }
    });
}

var http = require('http');

function sentToAmazon(postData){
            const options = {
                hostname: 'vcm-24018.vm.duke.edu',
                port: 8000,
                path: '/UpsEndpoint',
                method: 'POST',
                headers: {
                    'Content-Type': 'text/plain',
                    'Content-Length': postData.length
                }
            }
            
            const req_amazon = http.request(options, res => {
                res.on('data', d => {
                    process.stdout.write(d)
                  })
            })
            
            req_amazon.on('error', error => {
                console.error(error)
            })
            req_amazon.write(postData)
            req_amazon.end()
        }

export function sendpackageDelivered(req, res){
    let post_data = JSON.stringify({"packageDelivered":{"trackingNumber" : "1"}});
    console.log("send package delivered:  "+post_data);
    sentToAmazon(post_data);
    res.send("OK");
}

export function sendtruckArrived(req, res){
    let post_data = JSON.stringify({"truckArrived":{"trackingNumber" : 2, "truckid" : 2}});
    console.log("send truckArrived:  "+ post_data);
    sentToAmazon(post_data);
    res.send("OK");
}

export function returnGotit(req, res){
    console.log("I'm in return Gotit");
    let reqBody = JSON.parse(req.body);
    console.log(req.body);
    let trackNum = reqBody.truckArrived.trackingNumber;
    let truck_id = reqBody.truckArrived.truckid;
    console.log(trackNum);
    console.log(truck_id);
    res.send(JSON.stringify({"truckArrived":{"result" : "yes", "trackingNumber": trackNum.toString(), 'truckid' : truck_id.toString()}})); // Need to add more arguments
    console.log("after send return gotit");
}

export function returnGotit_2(req, res){
    console.log("I'm in return Gotit2");
    let reqBody = JSON.parse(req.body);
    console.log(req.body);
    let trackNum = reqBody.truckArrived.trackingNumber;
    console.log(trackNum);
    res.send(JSON.stringify({"packageDelivered":{"result" : "yes", "trackingNumber": trackNum.toString()}})); // Need to add more arguments
    console.log("after send return gotit2");
}

export const Request_Classify = async(req, res) => {
   let request = JSON.parse(req.body);
   console.log("In Request Classify");
    if (request.deliveryStatus){
        console.log("REQUEST TYPE: deliveryStatus");
        returnStatus(req,res);
    }
    if (request.startDelivery){
        console.log("REQUEST TYPE: startDelivery");
        addNewOrder(req,res);
    }
    if (request.truckLoaded){
        console.log("REQUEST TYPE: truckLoaded");
        goDeliver(req,res);

    }
    if (request.editAddress){
        console.log("REQUEST TYPE: editAddress");
        editAddress2(req, res);
    }
    if (request.cancelAddress){
        console.log("REQUEST TYPE: cancelAddress");
        cancelAddress(req, res);
    }
    //mock amazon
    if (request.truckArrived){
        console.log("REQUEST TYPE: truckArrived");
        returnGotit(req,res);
    }
}

    export const Request_Classify_ups = async(req, res) => {
        let request = JSON.parse(req.body);
        console.log("In Request Classify");
        
         //mock amazon
         if (request.truckArrived){
             console.log("REQUEST TYPE: truckArrived");
             returnGotit(req,res);
         }

         if (request.packageDelivered){
            console.log("REQUEST TYPE: packageDelivered");
            returnGotit_2(req,res);
        }
}

// export async function sendToWorldACK(command){
//     const task = new Task(
//       'simple task',
//       () => {SendToWorld(command)} 
//     );
//     const job = new SimpleIntervalJob({seconds: 10, runImmediately: true}, task, String(command.seqnum));
//     scheduler.addSimpleIntervalJob(job);
// }


// function SendToWorld(command){
//         let buffer = command.encodeDelimited(request).finish();
//         WORLD_SOCKET_UPS.write(buffer);
// }

// export async function getACK(seqNum){
//     console.log("ack num :" + seqNum);
//     scheduler.stopByID(seqNum);
//     console.log(scheduler.getById(seqNum).getStatus());
// }
