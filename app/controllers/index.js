import Ember from 'ember';
import ENV from "client/config/environment";

$.ajaxSetup({
  xhrFields: {
    withCredentials: true
  }
});

export default Ember.Controller.extend({
  isModalOpen: false,
  eventResults: [],
  eventResultsLength: false,
  selectedEvent: '',
  artistResults: [],
  step1: true,
  step2: false,
  step3: false,
  step4: false,
  playlistTitle: '',
  range: 6,
  creating: false,
  progress: '',
  complete: false,
  errorMessages: [],
  error: undefined,

  actions: {
    openModal() {
      if ((new Date()).getTime() > localStorage.getItem('access_token_expires')) {
        alert("Your Spotify session has expired");
        this.transitionToRoute('index');
      } else {
        this.toggleProperty('isModalOpen');
      }
    },
    
    closeModal() {
      if(this.get('complete') || this.get('error')) {
        // reset form
        this.set('eventResults', []);
        this.set('eventResultsLength', false);
        this.set('selectedEvent', '');
        this.set('artistResults', []);
        this.set('step1', true);
        this.set('step2', false);
        this.set('step3', false);
        this.set('step4', false);
        this.set('playlistTitle', '');
        this.set('range', 6);
        this.set('creating', false);
        this.set('progress', '');
        this.set('complete', false);
        this.set('errorMessages', []);
        this.set('error', undefined);
      }
      this.set('isModalOpen', false);
    },

    step1() {
      this.set('step1', true);
      this.set('step2', false);
      this.set('selectedEvent', '');
      this.set('eventResults', '');
      this.set('eventResultsLength', false);
    },

    step2() {
      this.set('step2', true);
      this.set('step1', false);
      this.set('step3', false);
      if(this.get('selectedEvent') === '') {
        $.getJSON(ENV.NODE_API+'api/v1/seatgeek/events?q='+this.get('search'))
          .then(function(response){
            if (!response.success) {
              this.set('error', response.error);
              return;
            } else if(response.events.length == 0) {
              this.set('eventResultsLength', true);
            } else {
              this.set('eventResults', response.events);
            }
          }.bind(this));
      }
    },

    selectEvent(selectedEvent) {
      this.set('selectedEvent', selectedEvent);
      this.get('eventResults').forEach(function(event) {
        if (event.id === selectedEvent.id) {
          Ember.set(event, 'selected', true);
        } else {
          Ember.set(event, 'selected', false);
        }
      })
    },

    step3() {
      if (this.get('selectedEvent') === '') {
        alert('Select an event!');
      } else {
        this.set('step3', true);
        this.set('step2', false);
        this.set('step4', false);
        this.set('artistResults', []);

        this.get('selectedEvent').artists.forEach(function(artist) {
          var genre = '';
          if (artist.genres) {
            genre = ' (' + artist.genres[0].name + ')';
          }

          this.get('artistResults').addObject({name: artist.name, genre: genre, checked: true});
        }.bind(this));
      }
    },

    step4() {
      this.set('playlistTitle', this.get('selectedEvent').title);
      this.set('step4', true);
      this.set('step3', false);
    },

    createPlaylist() {
      this.set('creating', true);
      this.set('step4', false);
      var promises = [];
      var playlistTitle = this.get('playlistTitle');
      var event = this.get('selectedEvent').title;
      var date =this.get('selectedEvent').date;
      var location = this.get('selectedEvent').location;

      this.set('progress', 'Searching for artists in Spotify...');

      this.get('artistResults').forEach(function(artist) {
        if (artist.checked) {
          promises.push($.getJSON(ENV.NODE_API+'api/v1/spotify/search?q='+encodeURIComponent(artist.name))
            .then(function(response){
              if (!response.success) {
                this.set('error', response.error);
                return;
              }

              if (response.error) {
                this.get('errorMessages').addObject(response.error);
              }
            }.bind(this)));
        }
      }.bind(this));


      Promise.all(promises).then(function() {
        this.set('progress', 'Finding the top ' + this.get('range') + ' tracks for each artist...');
        $.getJSON(ENV.NODE_API+'api/v1/spotify/artists/top-tracks?tracks='+this.get('range'))
          .then(function(response){
            if (!response.success) {
              this.set('error', response.error);
              throw('Error');
            }
            if (response.error.length > 0) {
              this.get('errorMessages').pushObjects(response.error.toArray());
            }
          }.bind(this))
          .then(function() {
            this.set('progress', 'Creating playlist \''+playlistTitle+'\'...');
            $.post(ENV.NODE_API+'api/v1/spotify/users/playlists?title='+encodeURIComponent(playlistTitle)+
                          '&event='+encodeURIComponent(event)+'&date='+encodeURIComponent(date)+'&location='+encodeURIComponent(location))
              .then(function(response2){
                if (!response2.success) {
                  this.set('error', response2.error);
                  throw('Error');
                }
                this.set('progress', 'Adding tracks...');
                $.post(ENV.NODE_API+'api/v1/spotify/users/playlists/tracks')
                  .then(function(response3) {
                    if (!response3.success) {
                      this.set('error', response3.error);
                      throw('Error');
                    }
                    this.set('progress', 'Added '+response3.tracks_size+' tracks to playlist \''+playlistTitle+'\'');
                    this.set('complete', true);
                  }.bind(this));
              }.bind(this));
          }.bind(this));
      }.bind(this));

    }
  }
});
