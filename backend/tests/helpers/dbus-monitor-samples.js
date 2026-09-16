/**
 * Real dbus-monitor --session --monitor output captured at the venue on
 * 2026-09-15 during E2E flow 22 (player video lifecycle), VLC sender :1.2607.
 *
 * Source capture: flow22-bus-capture.log. Lines are verbatim apart from the
 * capture own "HH:MM:SS.mmm " prefix, which has been stripped.
 *
 * Each export is the array of lines for ONE complete D-Bus message, exactly as
 * ProcessMonitor would hand them to DbusSignalParser.feedLine().
 */

const NAME_ACQUIRED = [
  "signal time=1789518739.753012 sender=org.freedesktop.DBus -> destination=:1.2598 serial=2 path=/org/freedesktop/DBus; interface=org.freedesktop.DBus; member=NameAcquired",
  "   string \":1.2598\"",
];

const LOOP_STATUS = [
  "signal time=1789518762.737228 sender=:1.2607 -> destination=(null destination) serial=5 path=/org/mpris/MediaPlayer2; interface=org.freedesktop.DBus.Properties; member=PropertiesChanged",
  "   string \"org.mpris.MediaPlayer2.Player\"",
  "   array [",
  "      dict entry(",
  "         string \"LoopStatus\"",
  "         variant             string \"None\"",
  "      )",
  "      dict entry(",
  "         string \"LoopStatus\"",
  "         variant             string \"None\"",
  "      )",
  "   ]",
  "   array [",
  "   ]",
];

const CAN_PLAY = [
  "signal time=1789518762.849596 sender=:1.2607 -> destination=(null destination) serial=8 path=/org/mpris/MediaPlayer2; interface=org.freedesktop.DBus.Properties; member=PropertiesChanged",
  "   string \"org.mpris.MediaPlayer2.Player\"",
  "   array [",
  "      dict entry(",
  "         string \"CanPlay\"",
  "         variant             boolean true",
  "      )",
  "   ]",
  "   array [",
  "   ]",
];

const TRACK_LIST = [
  "signal time=1789518762.852020 sender=:1.2607 -> destination=(null destination) serial=9 path=/org/mpris/MediaPlayer2; interface=org.freedesktop.DBus.Properties; member=PropertiesChanged",
  "   string \"org.mpris.MediaPlayer2.TrackList\"",
  "   array [",
  "   ]",
  "   array [",
  "      string \"Tracks\"",
  "   ]",
];

const METADATA_PLAYING = [
  "signal time=1789518762.990055 sender=:1.2607 -> destination=(null destination) serial=11 path=/org/mpris/MediaPlayer2; interface=org.freedesktop.DBus.Properties; member=PropertiesChanged",
  "   string \"org.mpris.MediaPlayer2.Player\"",
  "   array [",
  "      dict entry(",
  "         string \"Metadata\"",
  "         variant             array [",
  "               dict entry(",
  "                  string \"mpris:trackid\"",
  "                  variant                      object path \"/org/videolan/vlc/playlist/3\"",
  "               )",
  "               dict entry(",
  "                  string \"xesam:url\"",
  "                  variant                      string \"file:///home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend/public/videos/kai001.mp4\"",
  "               )",
  "               dict entry(",
  "                  string \"vlc:time\"",
  "                  variant                      uint32 27",
  "               )",
  "               dict entry(",
  "                  string \"mpris:length\"",
  "                  variant                      int64 27702000",
  "               )",
  "               dict entry(",
  "                  string \"vlc:encodedby\"",
  "                  variant                      string \"Lavf62.3.100\"",
  "               )",
  "               dict entry(",
  "                  string \"vlc:length\"",
  "                  variant                      int64 27702",
  "               )",
  "               dict entry(",
  "                  string \"vlc:publisher\"",
  "                  variant                      int32 5",
  "               )",
  "            ]",
  "      )",
  "      dict entry(",
  "         string \"PlaybackStatus\"",
  "         variant             string \"Playing\"",
  "      )",
  "      dict entry(",
  "         string \"CanPause\"",
  "         variant             boolean true",
  "      )",
  "      dict entry(",
  "         string \"CanSeek\"",
  "         variant             boolean true",
  "      )",
  "      dict entry(",
  "         string \"Rate\"",
  "         variant             double 1",
  "      )",
  "      dict entry(",
  "         string \"Volume\"",
  "         variant             double 1",
  "      )",
  "   ]",
  "   array [",
  "   ]",
];

module.exports = {
  NAME_ACQUIRED,
  LOOP_STATUS,
  CAN_PLAY,
  TRACK_LIST,
  METADATA_PLAYING,
};
