const DataSyncer = require('./DataSyncer.cjs');

const syncSchema = {
    offerId           : { collection : 'Offer', srcField : 'id' },
    offerName         : { collection : 'Offer', srcField : 'name',      idField : 'offerId' },
    offerBasePrice    : { collection : 'Offer', srcField : 'basePrice', idField : 'offerId' },
    offerCreatedBy    : { collection : 'Offer', srcField : 'createdBy', idField : 'offerId' },
    offerStartedAt    : { collection : 'Offer', srcField : 'startedAt', idField : 'offerId' },
    offerEndedAt      : { collection : 'Offer', srcField : 'endedAt',   idField : 'offerId' },
    eventId           : { collection : 'Offer', srcField : 'eventId',   idField : 'offerId' },
    eventType         : { collection : 'Event', srcField : 'type',      idField : 'eventId' },
    eventTrackId      : { collection : 'Event', srcField : 'trackId',   idField : 'eventId' }, 
    eventTrackName    : { collection : 'Track', srcField : 'name',      idField : 'eventTrackId' },    
    eventTrackCity    : { collection : 'Track', srcField : 'city',      idField : 'eventTrackId' },  
    eventTrackCountry : { collection : 'Track', srcField : 'country',   idField : 'eventTrackId' },   
    eventTrackFullNameUC  : { 
        collection : 'Track', 
        srcFields  : ['city', 'name', 'type'],      
        idField    : 'eventTrackId', 
        formatter  : o => {
            console.log('CALLING FORMATTER FOR eventTrackFullNameUC');
            return [o.city, o.name, o.type].join(' ').toUpperCase()
        },     
    },    
    publishMode       : { 
        collection : 'Track', 
        srcFields : ['isDraft'], 
        idField : 'eventTrackId',  
        formatter : o => (o.isDraft ? 'DRAFT' : 'PUBLISHED'), 
    },
    search : { collection : 'self', srcFields : ['eventTrackName', 'offerName'] } 
}

const SOURCE_DATA = {
    Offer : [
        {
            id: 20,
            name: 'MyOffer',
            basePrice: 200,
            createdBy: 123,
            startedAt: '2020-10-10',
            endedAt: '2020-10-10',
            eventId: 50
        }
    ],
    Track : [
        {
            id   : 10,
            name : 'MyTrack',
            city : 'Kyiv',
            country : 'Ukraine',
            type : 'RACING',
            isDraft : true,
        }
    ],

    Event : [
        {
            id : 50,
            name : 'MyTrack',
            city : 'Kyiv',
            trackId : 10,
            type : 'RACING'
        }
    ]
}

function dataLoader({ collection, id, fields}) {
    console.log('LOAD DATA SOURCE=%s ID=%s', collection, id);

    const object = SOURCE_DATA[collection].find(o => o.id === id);
    console.log('FOUND OBJECT', object);
    return Promise.resolve(object);
}

const syncer = new DataSyncer({ syncSchema, dataLoader });


async function main() {
    // const updateCommands = await syncer.processChange( {
    //     collection : 'Offer',
    //     id : 10,
    //     changed : {
    //         name  : 'NewName', 
    //         eventId : 333
    //     }
    // });

    console.time('processChange');
    const updateCommands = await syncer.processChange( {
        collection : 'Offer',
        id : 20,
        // changed : SOURCE_DATA.Offer[0]
    });
    console.timeEnd('processChange');
    console.log('UPDATE COMMANDS', updateCommands);
}

main().then(console.log, console.error);

