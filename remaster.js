// The Global Urban Boundary data of Liaoning- you can change this part into any boundary data of your research area, mind the calculation limit
var ln = ee.FeatureCollection('projects/acc10049/assets/LNWGS84'); 

//Some names and variables that may use, year is the one that is most important.
var bound = ln;
var areaname = 'liaoning';
var folder = 'liaoning';
var dur = '3years';
var year = 2006;
var date_1 = '-01-01';
var date_2 = '-12-31';

//PART1 cloud remove and 3-year
//mask functions
function maskL8sr(image) {
  // Bit 0 - Fill
  // Bit 1 - Dilated Cloud
  // Bit 2 - Cirrus
  // Bit 3 - Cloud
  // Bit 4 - Cloud Shadow
  var qaMask = image.select('QA_PIXEL').bitwiseAnd(parseInt('11111', 2)).eq(0);
  var saturationMask = image.select('QA_RADSAT').eq(0);

  // Apply the scaling factors to the appropriate bands.
  var opticalBands = image.select('SR_B.').multiply(0.0000275).add(-0.2);
  var thermalBands = image.select('ST_B.*').multiply(0.00341802).add(149.0);

  // Replace the original bands with the scaled ones and apply the masks.
  return image.addBands(opticalBands, null, true)
      .addBands(thermalBands, null, true)
      .updateMask(qaMask)
      .updateMask(saturationMask);
}

function maskL457sr(image) {
  // Bit 0 - Fill
  // Bit 1 - Dilated Cloud
  // Bit 2 - Unused
  // Bit 3 - Cloud
  // Bit 4 - Cloud Shadow
  var qaMask = image.select('QA_PIXEL').bitwiseAnd(parseInt('11111', 2)).eq(0);
  var saturationMask = image.select('QA_RADSAT').eq(0);

  // Apply the scaling factors to the appropriate bands.
  var opticalBands = image.select('SR_B.').multiply(0.0000275).add(-0.2);
  var thermalBand = image.select('ST_B6').multiply(0.00341802).add(149.0);

  // Replace the original bands with the scaled ones and apply the masks.
  return image.addBands(opticalBands, null, true)
      .addBands(thermalBand, null, true)
      .updateMask(qaMask)
      .updateMask(saturationMask);
}

//image sources
var l8 = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
                  .filter(ee.Filter.calendarRange(1,12,'month'))
                  .filterBounds(bound);

var l7 = ee.ImageCollection('LANDSAT/LE07/C02/T1_L2')
                  .filter(ee.Filter.calendarRange(1,12,'month'))
                  .filterBounds(bound);
                  
var l5 = ee.ImageCollection('LANDSAT/LT05/C02/T1_L2')
                  .filter(ee.Filter.calendarRange(1,12,'month'))
                  .filterBounds(bound);

//bands 
var bands8 = ['SR_B2','SR_B3','SR_B4','SR_B5','SR_B6','SR_B7'];
var bands75 = ['SR_B1','SR_B2','SR_B3','SR_B4','SR_B5','SR_B7'];

//change function, bands, images with year
var yourfunction = ee.Algorithms.If(
  year <= 2014,    //if <= 2014, use L7;
  maskL457sr, 
  ee.Algorithms.If(
    year <= 2020,  //if 2015-2020, use L8;
    maskL8sr
  )
);

var yourimage = ee.Algorithms.If(
  year <= 2014,    //if <= 2014, use L7;
  l7,             //
  ee.Algorithms.If(
    year <= 2020,  //if 2015-2020, use L8;
    l8
  )
);

var yourband = ee.Algorithms.If(
  year <= 2014,    //if <= 2014, use L7;
  bands8,             //
  ee.Algorithms.If(
    year <= 2020,  //if 2015-2020, use L8;
    bands75
  )
);

// Map the function over one year of data. for 2015-2020 L8, for 2000-2014 L7
var collection = yourimage
                     .filterDate(year+'-01-01', year+'-12-31')
                     .map(yourfunction);

//for every year, we have cloud-free 'composite' image of L7/L8
var composite = collection.median();
var composite = composite.select(yourband).clip(bound);

//PART2 PCA calculation
//Replace with the image from the cloud removal and three-year image compositing step
var arrayImage = composite.select(yourband).toArray();

var covar = arrayImage.reduceRegion({
  reducer: ee.Reducer.covariance(),
  scale:30,
  geometry:bound,
  maxPixels:1e13
})

var covarArray = ee.Array(covar.get('array'))

var eigens = covarArray.eigen()
var eigenVectors = eigens.slice(1,1)

var principalComponents = ee.Image(eigenVectors).matrixMultiply(arrayImage.toArray(1));

var pcImage = principalComponents
// Throw out an unneeded dimension, [[]] -> [].
.arrayProject([0])
// Make the one band array image a multi-band image, [] -> image
.arrayFlatten([['pc1','pc2','pc3','pc4','pc5','pc6']])

//we have PC1 as pca result for every year
var pc1 = pcImage.select('pc1')
var pc1 = pc1.multiply(1e8).toInt()
var pc1 = pc1.clip(bound)

//PART3 texture feature extraction


