import mongoose from "mongoose";

const Schema = mongoose.Schema;

export const OrderSchema = new Schema({
    warehouseID: {
        type:String,
        required:'Enter a warehouseID'
    },
    item: {
        type:String,
        required: 'Enter an item'
    },
    address:{
        type:String,
        requited: 'Enter an address'
    },
    priority:{
        type:Number,
        default: 1
    },
    trackingNumber:{
        type:Number,
        required: "Enter a trackingNumber"
    },
    userid: String,
    UPS_account: String,
    status: {
        type: String,
        default: "non_pickup"
    },
    seqnum: Number,
})

export const ContactSchema = new Schema({
    userid:{
        type: String,
        required: 'Enter an username'
    },
    password:{
        type: String,
        required: 'Enter an password'
    }
})

export const TruckSchema = new Schema({
    truckid:{
        type: Number,
        required: 'Enter an truck'
    },
    trackingNumber: {
        type: Number,
        default: -1
    }
})
