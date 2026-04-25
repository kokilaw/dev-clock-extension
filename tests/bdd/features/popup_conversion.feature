Feature: DevClock popup conversions
  As an engineer investigating logs
  I want to convert timestamps into Australia/Melbourne time
  So that I can quickly produce valid Splunk query windows

  Background:
    Given I open the DevClock popup

  Scenario: Convert ISO UTC input to Melbourne time
    When I enter the timestamp "2024-06-10T14:30:00Z"
    Then the converted ISO should be "2024-06-11T00:30:00+10:00"
    And the converted time should be "00:30:00"
    And the converted date should be "Tue, 11 Jun 2024"
    And the copy action buttons should be enabled

  Scenario: Handle time-only input (Implicit Today)
    When I enter the timestamp "14:30"
    Then the result should be calculated using today's date
    And the converted AU time should be displayed

  Scenario: Handle timezone-less input with a Toggle
    Given the input is "09:00" (no timezone)
    When I select the source timezone "UTC"
    And I note the current converted ISO value
    And I click the "US/Eastern" toggle
    Then the AU result should update to reflect a conversion from New York time
    And the Splunk query should update its time range accordingly

  Scenario: Parse military time without colons
    When I enter the timestamp "1545"
    Then it should be correctly interpreted as "3:45 PM"
    And the result card should be visible

  Scenario: Parse Unix Epoch (The Clipboard Special)
    When I enter the timestamp "1714012233"
    Then it should be treated as a Unix Epoch
    And the result should show the human-readable AU time for that exact second

  Scenario: Parse ISO-8601 with Milliseconds
    When I enter the timestamp "2026-04-25T04:15:22.455Z"
    Then the Splunk copy output should contain the exact timestamp
    And the Splunk copy output should use a ±1 minute range around that second

  Scenario: Handle Z (UTC) suffix independent of source toggle
    When I enter the timestamp "2026-04-25 04:15Z"
    And I note the current converted ISO value
    And I click the "US/Eastern" toggle
    Then the converted ISO should remain unchanged

  Scenario: Handle invalid input gracefully
    When I enter the timestamp "Meeting with Bob"
    Then the result card should not be visible
    And the parse error message "Unable to parse date" should be visible

  Scenario: Handle Daylight Savings Cross-over
    When I enter the timestamp "October 30th 2pm"
    Then the offset difference should reflect +15 hours

  Scenario: Auto-focus on Open
    Then the input field should have focus automatically

  Scenario: Persistent Toggle State
    Given I select the source timezone "UK/London"
    When I close and re-open the extension popup
    Then "UK/London" should still be the active toggle

  Scenario: Interpret naive ISO using selected source timezone
    When I select the source timezone "UTC"
    And I enter the timestamp "2024-06-10T14:30:00"
    Then the source timezone label should be "UTC"
    And the converted ISO should be "2024-06-11T00:30:00+10:00"
    And the Splunk preview should contain "2024-06-11T00:29:00+10:00"
    And the Splunk preview should contain "2024-06-11T00:31:00+10:00"

  Scenario: Convert unix epoch seconds and show Splunk window
    When I enter the timestamp "1718000000"
    Then the unix output should be "1718000000"
    And the converted ISO should be "2024-06-10T16:13:20+10:00"
    And the Splunk preview should contain "2024-06-10T16:12:20+10:00"
    And the Splunk preview should contain "2024-06-10T16:14:20+10:00"

  Scenario: Parse natural-language input
    When I enter the timestamp "yesterday at 5pm"
    Then the result card should be visible
    And the parse error should not be visible
    And the converted ISO should match the datetime pattern
    And the Splunk copy button should be enabled

  Scenario: Show parse error for invalid input
    When I enter the timestamp "this-is-not-a-time"
    Then the parse error should be visible
    And the Splunk copy button should be disabled
    And the time copy button should be disabled
