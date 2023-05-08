const converter = require('./svgToGcode')


converter("./inputs/shirt_shop_std_back.svg", "./output/", {
  laserIntensity: 22,
  laserOnSpeed: 400,
  laserOffSpeed: 259,
});

