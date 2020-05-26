class DataSyncer {
    constructor({syncSchema, dataLoader} = {}) {
        if (!syncSchema) throw new Error('SYNC_SCHEMA_REQUIRED');
        if (!dataLoader) throw new Error('DATA_LOADER_REQUIRED');

        this._syncSchema = syncSchema;
        this._dataLoader = dataLoader;
    }

    async processChange( { collection, id, changed } = { }, updateActions = [] ) {
        const sourceObject = await this._preloadSourceObject({ collection, id, changed });
        const affectedDstFields = this._getAffectedDstFieldsForSource({ collection, changed : sourceObject });
        const idField = affectedDstFields.map(dstField => this._syncSchema[dstField].idField).find(f=>f);

        const updateAction = {
            where: { [idField] : id },
            data : {}
        };

        for (const dstField of affectedDstFields) {
            // Recompute all affected dst fields 
            const fieldSchema = this._syncSchema[dstField];
            const srcFields = fieldSchema.srcField  ? [fieldSchema.srcField] : fieldSchema.srcFields;
            const dataObject = Object.fromEntries(srcFields.map( f => [f, sourceObject[f]] ));
            const formatter = fieldSchema.formatter || (dataObject => {
                return srcFields.map(f => dataObject[f]).join(' ');
            });

            updateAction.data[dstField] = formatter(dataObject);

            // Check for dependent collecations and run processChange recursively
            const derivedFieldSchema = this._findDerivedSchemaByIdField(dstField);
            if (derivedFieldSchema && derivedFieldSchema.collection !== collection) {
                    console.log('ID FIELD', dstField, derivedFieldSchema);
                    console.log('sourceObject', sourceObject);
                    await this.processChange({
                        collection : derivedFieldSchema.collection,
                        id     : sourceObject[fieldSchema.srcField],
                        changed : {}
                    }, updateActions);
            }
        }

        updateActions.unshift(updateAction);
        return updateActions;
    }

    async _preloadSourceObject({collection, id, changed}) {
        console.log('PRELOADING SOURCE=%s ID=%s', collection, id, changed);

        if (!changed || Object.keys(changed).length === 0) {
            const allFieldsToLoad = Object.values(this._syncSchema )
                .filter(s => s.collection === collection)
                .map( s => s.srcField || s.srcFields )
                .flat();

            return this._loadObject({ collection, id, fields: allFieldsToLoad });            
        } 
       
        const extraFieldsToLoad = Object.values(
                this._syncSchema
            ).filter(
                s => s.collection === collection 
                && s.srcFields 
                && s.srcFields.length > 1
                && s.srcFields.find( field => (field in changed) )
            ).map(
                s => s.srcFields
            ).flat().filter(
                field => !(field in changed)
            );

        if (extraFieldsToLoad.length === 0) {
            console.log('NOTHING TO PRELOAD');
            return changed;
        } else {
            console.log('DO PRELOAD', extraFieldsToLoad);
            const allFieldsToLoad = [...Object.keys(changed), ...new Set(extraFieldsToLoad)];
            return this._loadObject({ collection, id, fields: allFieldsToLoad });            
        }
    }

 
    async _loadObject({ collection, id, fields }) {
        const loadedObject = await this._dataLoader({ collection, id, fields });

        if (!loadedObject) {
            throw new Error(`OBJECT_NOT_LOADED collection=${collection} id=${id}`); 
        }

        
        for ( const fieldToLoad of fields ) {
            if (typeof loadedObject[fieldToLoad] === 'undefined') {
                throw new Error(`FIELD_IS_MISSED_IN_LOADED_DATA = "${fieldToLoad}"`);
            } 
        }

        return loadedObject;
    }

    _getAffectedDstFieldsForSource({ collection, changed }) {
        const affectedDstFields = [];

        for ( const [dstField, fieldSchema] of Object.entries(this._syncSchema) ) {
            if (fieldSchema.collection !== collection) continue;

            const isMatchedField = 
                typeof(changed[fieldSchema.srcField]) !== 'undefined'
                || ( fieldSchema.srcFields 
                    && fieldSchema.srcFields.find( field => typeof(changed[field]) !== 'undefined' )
                );

            if (isMatchedField) {
                affectedDstFields.push(dstField);
            }
        }

        return affectedDstFields;
    }

    _getDependendentDstFields({collection, srcField}) {
        const dependendentDstFields = [];

        for ( const [dstField, fieldSchema] of Object.entries(this._syncSchema) ) {
            const isMatchedField =
                fieldSchema.collection === collection 
                && (
                    fieldSchema.srcField === srcField 
                    || (fieldSchema.srcFields && fieldSchema.srcFields.includes(srcField)) 
                );

            if (isMatchedField) {
                dependendentDstFields.push({dstField, fieldSchema});
            }
        }

        return dependendentDstFields;
    }

    _findDerivedSchemaByIdField(field) {
        return Object.values(this._syncSchema).find(s => s.idField === field);
    }
}

module.exports = DataSyncer;