Feature: LogTime Sync popup conversions
  As an engineer investigating logs
  I want to convert timestamps into Australia/Melbourne time
  So that I can quickly produce valid Splunk query windows

  Background:
    Given I open the LogTime Sync popup

  Scenario: Convert ISO UTC input to Melbourne time
    When I enter the timestamp "2024-06-10T14:30:00Z"
    Then the converted ISO should be "2024-06-11T00:30:00+10:00"
    And the converted time should be "00:30:00"
    And the converted date should be "Tue, 11 Jun 2024"
    And the copy action buttons should be enabled

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
