# TODO:

### Map
- Bounding box search implementation (when we have more data)
- Include comments in the search??? (maybe idk)

### UI/UX
- Mobile needs lots of work:
  - Sometimes the top controls don't show (search, profile, friends)
  - Need to zoom out on browser to see most content (it overflows horizonatlly?)
- Create more solid global styles for colors, fonts, shapes, etc.?
- Feed? shows new and trending activities
  - Add "Hometown" to user profile, to understand where to reccommend trips
- AI trip builder based on activites/lodges we have saved??
- Declining a friend requesst doesn't seem to work

### Optimization

### Database
- Enable account deletion. Require email verification?
- Cleanup for plans migration
  - travelers.saved_activity_ids and travelers.saved_lodging_ids are no longer written to
    - ALTER TABLE travelers DROP COLUMN saved_activity_ids;
    - ALTER TABLE travelers DROP COLUMN saved_lodging_ids;

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