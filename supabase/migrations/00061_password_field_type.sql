-- Add 'password' to the collection_fields field_type check constraint
ALTER TABLE collection_fields
  DROP CONSTRAINT collection_fields_field_type_check;

ALTER TABLE collection_fields
  ADD CONSTRAINT collection_fields_field_type_check
    CHECK (field_type IN (
      'text', 'number', 'date', 'datetime', 'boolean', 'file',
      'select', 'multiselect', 'richtext', 'json', 'relation', 'password'
    ));
