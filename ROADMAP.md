# Roadmap

## v0.2
- [x] Separate the existing codebase into the following
	- [x] Adapter: elFinder 
	- [x] LocalFileStorage Driver: elFinder.LocalFileStorage
	- [x] utilities: elFinder.utils
- [x] Create a standard interface for volume drivers
- [x] Remove user from LocalFileStorage

## v.0.3
- [x] Utils implementation
	- [x] volume
	- [x] encode
	- [x] decode: { volume, path, name }
- [x] Pass `res` object to driver functions
- [ ] Refactor LFS to use utils when they replace private functions
- [ ] Refactor private.parse to use utils || remove it from code
- [ ] Remove dependency of LFS on private.volume
- [ ] Remove adapter's dependency on LFS

## v0.4
- [ ] Remove `file` access dependency from the connector (to be done in LFS)
- [ ] Pass router in adapter to driver to allow custom routes
- [ ] Move thumb access to driver

## v0.5 (Standardizing the API)
- [ ] Change configuration structure to eFinder [connector configuration ](https://github.com/Studio-42/elFinder/wiki/Connector- configuration- options)
- [ ] Create guide for plugin implementation
- [ ] Document API for others to implement volume drivers
- [ ] Create code sample to be used for implementing volume drivers

## v0.6 (Implement missing API features in LFS)
- [ ] mkfile
- [ ] chmod
- [ ] zipdl
- [ ] open
- [ ] edit
- [ ] put
- [ ] size

## v1.0
- [ ] Translate [connector configuration ](https://github.com/Studio-42/elFinder/wiki/Connector- configuration- options) from PHP to JavaScript
- [ ] Implement other connector options
