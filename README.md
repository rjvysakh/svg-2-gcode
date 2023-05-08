# svg_gcode

"svg_gcode" is an npm package that converts SVG file inputs into G-code text. It is a modified version of the open source repository "gcodercnc2d5" by drandrewthomas, with additional modifications using jQuery.

## Installation

You can install the package using npm:

```
npm install svg_gcode
```

## Usage

Here's an example of how to use "svg_gcode" to convert an SVG file into G-code text:

```javascript
const svgGcode = require('svg_gcode');

// Read SVG file contents from a file or a string
const svgIn = './images/image.svg';

// Convert SVG to G-code

svgGcode(svgIn {
  laserIntensity: 22,
  laserOnSpeed: 400,
  laserOffSpeed: 259,
}).then((gcode)=> console.log(gcode));

```

The `svgGcode()` function takes an SVG file input as a string and returns the G-code text as a string. You can pass the SVG file input as a string or read it from a file.

## Credits

This package is based on the open source repository "gcodercnc2d5" by drandrewthomas. You can find the original repository here: https://github.com/drandrewthomas/gcodercnc2d5.

## License

This package is licensed under the MIT License. See the LICENSE file for details.