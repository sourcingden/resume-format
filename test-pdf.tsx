import { renderToFile, Document, Page, View, Image } from '@react-pdf/renderer';
import React from 'react';

const MyDoc = () => {
  return (
    <Document>
      <Page size="A4">
        <View style={{ height: 200, backgroundColor: 'red' }} />
        <View 
          fixed 
          style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }} 
          render={({ pageNumber, totalPages }) => 
            pageNumber === totalPages ? <View style={{ height: 50, backgroundColor: 'blue', width: '100%' }} /> : null
          } 
        />
      </Page>
    </Document>
  );
};

renderToFile(<MyDoc />, 'test.pdf')
  .then(() => console.log('success'))
  .catch(e => console.error(e));
