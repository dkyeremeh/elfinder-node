- Separate the existing codebase into the following
	- Adapter: elFinder 
	- LocalFileStorage Driver: elFinder.LocalFileStorage
	- utilities: elFinder.utils

- Create a standard interface for plugin and external drivers
	- standardise configuration
	- standardise plugin init

- Utils
	- volume
	- parse
	- encode
	- decode
- Modify adapter to call each driver for each volume

- Remove user from LocalFileStorage
- Pass `res` object to driver functions
- Move `file` implementation from adapter to driver
- Move thumb implementation to driver []