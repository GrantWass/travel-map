# TODO:

### Map
- Bounding box search implementation (when we have more data)
- Include comments in the search??? (maybe idk)

### UI
- Mobile needs some work:
  - Sometimes the top controls don't show (search, profile, friends)
  - Need to zoom out on browser to see most content (it overflows horizonatlly?)
- Create more solid global styles for colors, fonts, shapes, etc.?
- Feed? shows new and trending activities
  - Add "Hometown" to user profile, to understand where to reccommend trips
- AI trip builder based on activites/lodges we have saved??
- Declining a friend requesst doesn't seem to work

### UX
- Declining a friend requesst doesn't seem to work
- Can't see collaborated trips on profile
- I am friends with Joey twice
- When in a collection, show activities/lodgings on map?

### Database
- Enable account deletion. Require email verification?

### Code
- Refactor when possible for readability
- Split up map store if possible? It's huge
- ^^^ same with trip_service.py

### Platform
- Get a domain
- Better auth work
  - Email verification?
- Revist SMS
- Copy current data to create local mock database for development
  - Reduce costs a little
  - Keeps prod data safe
  - No more test data on prod

### Testing
- A few E2E playwright tests
- API tests
- DB tests (ideally with dev database ^^^)