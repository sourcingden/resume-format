import { renderToFile, Document, Page, View, Image } from '@react-pdf/renderer';
import React from 'react';

const MyDoc = () => {
  return (
    <Document>
      <Page size="A4" style={{ paddingTop: 40, paddingBottom: 40, backgroundColor: 'white' }}>
        <View style={{ height: 600, backgroundColor: 'red' }} />
        
        {/* Fill remaining space */}
        <View style={{ flexGrow: 1 }} />
        
        {/* Footer */}
        <View style={{ height: 50, backgroundColor: 'blue', width: '100%', marginBottom: -40 }} />
      </Page>
    </Document>
  );
};

renderToFile(<MyDoc />, 'test-flex.pdf')
  .then(() => console.log('success'))
  .catch(e => console.error(e));
